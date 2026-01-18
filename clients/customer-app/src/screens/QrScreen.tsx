import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { customersApi } from '../api/client';

export default function QrScreen() {
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    loadQrToken();
    const interval = setInterval(loadQrToken, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadQrToken = async () => {
    try {
      const response = await customersApi.getQrToken();
      setQrToken(response.data.qrToken);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load QR token');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your QR Code</Text>
      {qrToken ? (
        <QRCode value={qrToken} size={200} />
      ) : (
        <Text>{error || 'Loading...'}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    marginBottom: 20,
  },
});
