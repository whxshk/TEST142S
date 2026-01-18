import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { connect, NatsConnection, JSONCodec } from 'nats';

@Injectable()
export class OutboxDispatcherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxDispatcherService.name);
  private nc: NatsConnection | null = null;
  private intervalId: NodeJS.Timeout | null = null;
  private readonly jsonCodec = JSONCodec();

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async onModuleInit() {
    const natsUrl = this.configService.get<string>('nats.url') || 'nats://localhost:4222';
    
    try {
      this.nc = await connect({ servers: natsUrl });
      this.logger.log(`Connected to NATS at ${natsUrl}`);

      const pollInterval = this.configService.get<number>('outbox.pollIntervalMs') || 5000;
      const batchSize = this.configService.get<number>('outbox.batchSize') || 100;

      // Start polling for pending events
      this.intervalId = setInterval(() => {
        this.processOutboxEvents(batchSize).catch((error) => {
          this.logger.error('Error processing outbox events', error);
        });
      }, pollInterval);

      this.logger.log(`Outbox dispatcher started (poll interval: ${pollInterval}ms)`);
    } catch (error) {
      this.logger.error('Failed to connect to NATS', error);
    }
  }

  async onModuleDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    if (this.nc) {
      await this.nc.close();
      this.logger.log('NATS connection closed');
    }
  }

  private async processOutboxEvents(batchSize: number) {
    if (!this.nc) {
      return;
    }

    const pendingEvents = await this.prisma.outboxEvent.findMany({
      where: {
        status: 'PENDING',
      },
      take: batchSize,
      orderBy: {
        createdAt: 'asc',
      },
    });

    if (pendingEvents.length === 0) {
      return;
    }

    this.logger.debug(`Processing ${pendingEvents.length} outbox events`);

    for (const event of pendingEvents) {
      try {
        const topic = `loyalty.${event.eventType}`;
        const payload = this.jsonCodec.encode(event.payload as any);

        this.nc.publish(topic, payload);
        await this.nc.flush();

        // Mark as published
        await this.prisma.outboxEvent.update({
          where: { id: event.id },
          data: {
            status: 'PUBLISHED',
            publishedAt: new Date(),
          },
        });

        this.logger.debug(`Published event ${event.id} to ${topic}`);
      } catch (error) {
        this.logger.error(`Failed to publish event ${event.id}`, error);

        // Increment retry count
        const retryCount = event.retryCount + 1;
        const maxRetries = this.configService.get<number>('outbox.maxRetries') || 3;

        if (retryCount >= maxRetries) {
          await this.prisma.outboxEvent.update({
            where: { id: event.id },
            data: {
              status: 'FAILED',
              retryCount,
            },
          });

          this.logger.warn(`Event ${event.id} marked as FAILED after ${retryCount} retries`);
        } else {
          await this.prisma.outboxEvent.update({
            where: { id: event.id },
            data: {
              retryCount,
            },
          });
        }
      }
    }
  }
}
