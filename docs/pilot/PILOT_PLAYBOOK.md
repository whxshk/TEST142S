# SharkBand Pilot Playbook

This playbook provides step-by-step instructions for running successful pilots with merchants.

## Quick Start: Onboard a Merchant in 10 Minutes

### Step 1: Merchant Signup (2 minutes)
1. Navigate to merchant signup endpoint: `POST /api/v1/onboarding/merchant-signup`
2. Provide:
   - Merchant name
   - Admin email
   - Admin password (min 8 characters)
   - First location name
   - Location address (optional)
3. Save the returned `tenantId` and `userId`

### Step 2: Create Initial Rewards (3 minutes)
1. Login as merchant admin
2. Create 2-3 simple rewards:
   - **Starter reward**: 50 points → "Free drink"
   - **Mid-tier reward**: 100 points → "Free meal"
   - **Premium reward**: 200 points → "Free dessert + drink"
3. Keep rewards simple and achievable

### Step 3: Invite Staff (2 minutes)
1. Use `POST /api/v1/onboarding/invite-staff`
2. Send invite link to staff member
3. Staff accepts invite and sets password
4. Staff gets `scan:*` scope automatically

### Step 4: Register Device (2 minutes)
1. Staff logs into vendor app
2. Device registration happens automatically on first login
3. Device is tied to location

### Step 5: First Scan (1 minute)
1. Customer opens customer app and displays QR code
2. Staff scans QR code using vendor app
3. Issue 10-20 points for first transaction
4. **Success!** Merchant is now operational

---

## What Rewards to Start With

### Recommended Default Rewards

**Tier 1: Quick Win (50 points)**
- Free coffee/tea
- Small discount (10%)
- Free side item

**Tier 2: Standard Reward (100 points)**
- Free main item
- 20% discount
- Free combo meal

**Tier 3: Premium Reward (200 points)**
- Free full meal
- 30% discount
- Free dessert + drink combo

### Points Issuance Guidelines
- **Small purchase** (< $10): 10-20 points
- **Medium purchase** ($10-25): 25-50 points
- **Large purchase** (> $25): 50-100 points

**Rule of thumb**: Customer should earn enough points for Tier 1 reward after 2-3 visits.

---

## What to Tell Staff (Script)

### During Setup
> "We're launching a new loyalty program. You'll use this app to scan customer QR codes and give them points. It's simple - just scan, enter the amount, and confirm. The app handles everything else."

### During Operations
> "When a customer wants to redeem, scan their QR code, select the reward, and confirm. The system checks their balance automatically."

### Common Questions

**Q: What if the scan fails?**
> "Check that the QR code is fresh (not expired). If it still fails, ask customer to refresh their QR code in the app."

**Q: What if customer doesn't have enough points?**
> "The system will tell you. Just let the customer know they need X more points. You can see their balance on the screen."

**Q: What if I make a mistake?**
> "Don't worry - contact the manager. They can fix it using the admin tools."

---

## What to Tell Customers (Script)

### First Time Setup
> "Download the SharkBand app, create an account, and you'll get a QR code. Show this QR code at checkout to earn points. Your points work at all participating merchants!"

### During Visit
> "Show your QR code at checkout to earn points. You can redeem points for rewards - check the app to see what's available!"

### Common Questions

**Q: How do I see my points?**
> "Open the app - your balance is shown on the main screen."

**Q: Can I use points at other stores?**
> "Yes! Your points work at any merchant using SharkBand."

**Q: Do points expire?**
> "No, your points never expire. Use them whenever you want!"

---

## Daily Checks (5 Minutes)

### Morning Checklist
1. **Check fraud signals** (`GET /api/v1/fraud-signals`)
   - Look for `HIGH_SCAN_VOLUME` or `HIGH_REDEMPTION_VOLUME`
   - Review error counts

2. **Check rate limits**
   - Verify no devices are hitting limits
   - Check for repeated failed redemptions

3. **Review yesterday's transactions**
   - Check transaction volume
   - Look for unusual patterns

### Weekly Review (30 Minutes)
1. **Run weekly report** (`GET /api/v1/analytics/pilot-weekly-report`)
2. **Review metrics**:
   - Active customers trend
   - Redemption rate
   - Repeat customer rate
   - Error rate
3. **Check onboarding funnel** (`GET /api/v1/analytics/pilot-onboarding-funnel`)
   - Time to first scan
   - Completion rate

---

## How to Handle Mistakes

### Scenario 1: Wrong Points Issued
**Solution**: Use manual adjustment
```
POST /api/v1/operator-tools/adjustment
{
  "customerId": "...",
  "amount": -10,  // negative to deduct, positive to add
  "reason": "Corrected incorrect points issuance"
}
```

### Scenario 2: Customer Redeemed Wrong Reward
**Solution**: Reverse the transaction
```
POST /api/v1/operator-tools/reverse
{
  "transactionId": "...",
  "reason": "Customer requested different reward"
}
```

### Scenario 3: Device Issues
**Solution**: 
1. Check device registration (`GET /api/v1/devices`)
2. Verify device is active
3. Re-register if needed

### Scenario 4: QR Code Not Working
**Solution**:
1. Check QR token expiration (should rotate every 30 seconds)
2. Verify customer app is connected to internet
3. Check for clock skew issues

---

## Weekly Review Checklist

### Metrics to Review
- [ ] Active customers (should be growing)
- [ ] Repeat customers (target: >30% of active)
- [ ] Redemption rate (target: >20%)
- [ ] Transaction volume (should be consistent)
- [ ] Error rate (should be <5%)
- [ ] Manual interventions (should be minimal)

### Action Items
- [ ] Review "What Needs Fixing" from weekly report
- [ ] Address any high error rates
- [ ] Check onboarding funnel for new merchants
- [ ] Review top rewards (adjust if needed)
- [ ] Plan improvements for next week

### Red Flags
- **Error rate >10%**: Check device setup and QR token rotation
- **Redemption rate <10%**: Rewards may not be attractive enough
- **Repeat customer rate <20%**: Engagement issues
- **Many manual adjustments**: Process needs improvement

---

## Troubleshooting Guide

### Issue: Low Transaction Volume
**Possible causes**:
- Staff not using the system
- Customers not aware of program
- QR codes not working

**Solutions**:
1. Train staff again
2. Add signage in store
3. Check QR token rotation

### Issue: High Error Rate
**Possible causes**:
- Expired QR tokens
- Device connectivity issues
- Clock skew

**Solutions**:
1. Verify QR rotation interval (30 seconds default)
2. Check device internet connection
3. Sync device clocks

### Issue: Low Redemption Rate
**Possible causes**:
- Rewards not attractive
- Points too hard to earn
- Customers don't know about rewards

**Solutions**:
1. Review reward points requirements
2. Adjust points issuance amounts
3. Add in-store promotion for rewards

### Issue: Onboarding Taking Too Long
**Check funnel metrics**:
- Time to first location > 5 minutes → Issue with signup flow
- Time to first staff > 30 minutes → Invite process needs work
- Time to first device > 1 hour → Device registration friction
- Time to first scan > 2 hours → Staff training needed

---

## Success Criteria

### Week 1 Goals
- ✅ Merchant onboarded and operational
- ✅ At least 10 active customers
- ✅ At least 1 redemption
- ✅ Error rate <10%

### Week 2 Goals
- ✅ 20+ active customers
- ✅ 5+ repeat customers
- ✅ Redemption rate >15%
- ✅ Error rate <5%

### Week 4 Goals
- ✅ 50+ active customers
- ✅ 15+ repeat customers (30% retention)
- ✅ Redemption rate >20%
- ✅ Error rate <3%
- ✅ Minimal manual interventions

---

## Best Practices

1. **Start Simple**: Begin with 2-3 rewards, add more later
2. **Train Staff Early**: First week is critical for adoption
3. **Monitor Daily**: Catch issues early
4. **Communicate**: Keep merchants informed of their metrics
5. **Iterate**: Use weekly reports to improve

---

## Support Contacts

- **Technical Issues**: Check logs, review error messages
- **Process Questions**: Refer to this playbook
- **Merchant Concerns**: Review weekly report together

---

## Appendix: API Endpoints Reference

### Onboarding
- `POST /api/v1/onboarding/merchant-signup` - Create merchant
- `POST /api/v1/onboarding/invite-staff` - Invite staff
- `POST /api/v1/onboarding/accept-invite` - Accept invite

### Operations
- `POST /api/v1/transactions/issue` - Issue points (scan)
- `POST /api/v1/transactions/redeem` - Redeem points

### Safety Tools
- `POST /api/v1/operator-tools/adjustment` - Manual adjustment
- `POST /api/v1/operator-tools/reverse` - Reverse transaction

### Reporting
- `GET /api/v1/analytics/pilot-weekly-report?week=YYYY-WW` - Weekly report
- `GET /api/v1/analytics/pilot-onboarding-funnel` - Onboarding metrics
- `GET /api/v1/fraud-signals` - Misuse signals

---

**Last Updated**: 2025-01-XX
**Version**: 1.0
