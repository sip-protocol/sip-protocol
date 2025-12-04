# Sentry Alert Rules Configuration

This document outlines recommended Sentry alert rules for production monitoring of SIP Protocol applications.

**Note:** These alerts must be configured via the Sentry Dashboard. This document serves as a reference for setting up alerts consistently across all SIP Protocol projects.

## Overview

Sentry alerts help you catch production issues early by notifying your team when specific conditions are met. The rules below cover error rates, performance degradation, new issues, and release health.

## Alert Rule Categories

### 1. Error Rate Thresholds

Monitor error rates to detect sudden spikes or sustained elevated error levels.

#### High Error Rate Alert

**When to alert:** Error count exceeds normal baseline

**Configuration:**
```
Name: High Error Rate
Condition: Number of events
Threshold: > 100 events in 5 minutes
Filter:
  - Environment: production
  - event.type: error
Action: Send notification to #alerts-production
```

**Why:** Catches sudden error spikes that may indicate a broken deployment or infrastructure issue.

#### Sustained Error Rate

**When to alert:** Consistent elevated errors over time

**Configuration:**
```
Name: Sustained Error Rate
Condition: Number of events
Threshold: > 50 events in 1 hour
Filter:
  - Environment: production
  - event.type: error
Action: Send notification to #alerts-production
```

**Why:** Identifies ongoing issues that may not trigger spike alerts but indicate degraded service quality.

#### Critical Error Rate (User-Facing)

**When to alert:** Errors affecting user-facing features

**Configuration:**
```
Name: Critical User-Facing Errors
Condition: Number of events
Threshold: > 10 events in 1 minute
Filter:
  - Environment: production
  - event.type: error
  - Tags: level = error OR level = fatal
  - Tags: transaction matches /api/swap OR /api/quote
Action:
  - Send notification to #alerts-critical
  - Page on-call engineer (PagerDuty/Opsgenie)
```

**Why:** Swap and quote APIs are critical user flows. Fast response prevents user impact.

### 2. Performance Degradation

Monitor application performance to catch slowdowns before users complain.

#### API Response Time Degradation

**When to alert:** API endpoints become slow

**Configuration:**
```
Name: Slow API Response Time
Condition: Average transaction duration
Threshold: > 2000ms (2 seconds)
Filter:
  - Environment: production
  - Transaction: /api/swap OR /api/quote
Time window: 10 minutes
Action: Send notification to #alerts-performance
```

**Why:** Slow swap/quote APIs directly impact UX. 2s is too slow for user actions.

#### Page Load Performance

**When to alert:** Frontend pages load slowly

**Configuration:**
```
Name: Slow Page Load
Condition: p75(transaction.duration)
Threshold: > 3000ms (3 seconds)
Filter:
  - Environment: production
  - Transaction operation: pageload
Time window: 15 minutes
Action: Send notification to #alerts-performance
```

**Why:** Slow page loads harm user experience and SEO. p75 catches sustained slowness.

#### Database Query Performance

**When to alert:** Database queries become slow (if applicable)

**Configuration:**
```
Name: Slow Database Queries
Condition: p95(span.duration)
Threshold: > 1000ms (1 second)
Filter:
  - Environment: production
  - Span operation: db.query
Time window: 10 minutes
Action: Send notification to #alerts-performance
```

**Why:** Slow DB queries cascade into API and page slowness. Catch early.

### 3. New Error Types

Alert when new, unseen errors appear in production.

#### New Issue Alert

**When to alert:** First occurrence of a new error

**Configuration:**
```
Name: New Production Error
Condition: A new issue is created
Filter:
  - Environment: production
  - Issue category: error
Action: Send notification to #alerts-new-issues
```

**Why:** New errors after a deploy may indicate regression. Review immediately.

#### Regressed Issue Alert

**When to alert:** Previously resolved issue reappears

**Configuration:**
```
Name: Regressed Issue
Condition: Issue changes state to regressed
Filter:
  - Environment: production
Action: Send notification to #alerts-regressions
```

**Why:** Regressions indicate incomplete fixes or new code breaking old fixes.

#### High-Volume New Issue

**When to alert:** New error affects many users quickly

**Configuration:**
```
Name: High-Volume New Issue
Condition: Number of events in an issue
Threshold: > 50 events in 5 minutes
Filter:
  - Environment: production
  - Issue is less than 1 hour old
Action:
  - Send notification to #alerts-critical
  - Page on-call engineer
```

**Why:** New high-volume errors suggest widespread impact requiring immediate action.

### 4. Release Health

Monitor release stability and user adoption.

#### Release Crash Rate

**When to alert:** New release has high crash rate

**Configuration:**
```
Name: High Release Crash Rate
Condition: Crash free sessions
Threshold: < 95%
Filter:
  - Environment: production
  - Release: latest
Time window: 1 hour after deploy
Action: Send notification to #alerts-releases
```

**Why:** High crash rates indicate problematic release. Consider rollback.

#### Release Adoption Issues

**When to alert:** Users not adopting new release (client apps)

**Configuration:**
```
Name: Low Release Adoption
Condition: Release adoption
Threshold: < 50% after 24 hours
Filter:
  - Environment: production
  - Release: latest
Action: Send notification to #alerts-releases
```

**Why:** Low adoption may indicate deployment issues or user hesitation.

#### Deploy Success Check

**When to alert:** Post-deploy verification

**Configuration:**
```
Name: Post-Deploy Error Spike
Condition: Percentage change in events
Threshold: > 50% increase compared to previous period
Filter:
  - Environment: production
  - Time window: 15 minutes after deploy
Action:
  - Send notification to #alerts-deploys
  - Consider automated rollback
```

**Why:** Catch broken deploys fast. Compare to pre-deploy baseline.

## 5. Business-Critical Metrics

SIP Protocol specific alerts for core functionality.

#### Swap Success Rate

**When to alert:** Swap completion rate drops

**Configuration:**
```
Name: Low Swap Success Rate
Condition: Custom metric
Threshold: swap_success_rate < 90%
Filter:
  - Environment: production
Time window: 10 minutes
Action: Send notification to #alerts-critical
```

**Why:** Swap failures directly impact revenue and user trust.

**Implementation:** Requires custom metric tracking in application code:
```typescript
Sentry.metrics.increment('swap_attempt')
Sentry.metrics.increment('swap_success')
// Calculate rate in Sentry Discover
```

#### Privacy Feature Errors

**When to alert:** Stealth address or commitment generation fails

**Configuration:**
```
Name: Privacy Feature Failures
Condition: Number of events
Threshold: > 5 errors in 5 minutes
Filter:
  - Environment: production
  - Error message matches /stealth|commitment|encryption/i
Action: Send notification to #alerts-critical
```

**Why:** Privacy is core value prop. Failures harm trust and compliance.

#### Wallet Connection Failures

**When to alert:** Users can't connect wallets

**Configuration:**
```
Name: Wallet Connection Failures
Condition: Number of events
Threshold: > 10 errors in 5 minutes
Filter:
  - Environment: production
  - Error message matches /wallet|connection/i
  - Exclude: User rejected, User denied
Action: Send notification to #alerts-critical
```

**Why:** Can't use app without wallet. Excludes user-initiated rejections.

## Alert Notification Channels

### Recommended Setup

1. **#alerts-critical** (Slack/Discord)
   - High-volume new issues
   - Critical user-facing errors
   - Swap/privacy failures
   - On-call paging integration

2. **#alerts-production** (Slack/Discord)
   - High error rates
   - Sustained error rates
   - General production issues

3. **#alerts-performance** (Slack/Discord)
   - API slowness
   - Page load degradation
   - Database query issues

4. **#alerts-new-issues** (Slack/Discord)
   - New errors
   - Low priority for investigation

5. **#alerts-regressions** (Slack/Discord)
   - Regressed issues
   - Review for incomplete fixes

6. **#alerts-releases** (Slack/Discord)
   - Release health
   - Deploy success/failure
   - Adoption tracking

7. **#alerts-deploys** (Slack/Discord)
   - Post-deploy monitoring
   - Automated rollback notifications

### Email Alerts

Configure email digests for non-urgent alerts:
- Daily summary of new issues
- Weekly performance report
- Monthly release health report

## Alert Tuning

### Avoiding Alert Fatigue

1. **Start Conservative:** Begin with higher thresholds, tighten as you learn normal patterns
2. **Use Grouping:** Group similar errors to reduce noise
3. **Set Quiet Hours:** Reduce non-critical alerts during off-hours
4. **Regular Review:** Weekly review of alert effectiveness and false positives

### Threshold Recommendations by Project Size

| Metric | Small (<1k users) | Medium (1k-10k) | Large (>10k) |
|--------|-------------------|-----------------|--------------|
| Error rate (5min) | >20 | >100 | >500 |
| API response time | >3s | >2s | >1s |
| Page load p75 | >5s | >3s | >2s |
| Crash free rate | <90% | <95% | <98% |

## Integration with On-Call Rotation

### Critical vs Non-Critical

**Page on-call for:**
- Critical user-facing errors (swap/quote failures)
- High-volume new issues (>50 errors in 5 minutes)
- Crash rate >5% in new release
- Swap success rate <90%
- Privacy feature failures

**Don't page for:**
- Individual new issues (review async)
- Performance degradation (unless critical API)
- Known intermittent issues
- User-initiated errors (wallet rejections)

### Escalation Policy

1. **L1 Alert:** Slack notification to #alerts-critical
2. **L2 Alert (5min):** Page on-call engineer via PagerDuty/Opsgenie
3. **L3 Alert (15min):** Escalate to senior engineer
4. **L4 Alert (30min):** Escalate to engineering manager

## Testing Alerts

Before going live, test each alert rule:

1. **Trigger Test Alert:** Use Sentry's "Send Test Notification" feature
2. **Verify Channels:** Confirm notifications reach correct Slack channels
3. **Validate Thresholds:** Use historical data to check if thresholds are reasonable
4. **Simulate Issues:** Trigger real errors in staging to verify alert logic

## Monitoring Alert Effectiveness

Track these metrics for your alert rules:

- **Alert volume:** How many alerts per day/week?
- **False positive rate:** Alerts that don't require action
- **Time to resolution:** How long from alert to fix?
- **Repeat alerts:** Same issue alerting multiple times

**Goal:** <10 alerts per week, <5% false positives, <15min time to acknowledge

## Configuration Checklist

Before enabling alerts in production:

- [ ] Install @sentry/nextjs in all projects
- [ ] Configure SENTRY_DSN in production environment
- [ ] Set up Slack integration in Sentry
- [ ] Create alert notification channels
- [ ] Configure at least 5 core alerts (error rate, new issues, performance, release health, business-critical)
- [ ] Test each alert rule in staging
- [ ] Document on-call escalation policy
- [ ] Set up PagerDuty/Opsgenie for critical alerts
- [ ] Train team on alert response procedures
- [ ] Schedule weekly alert effectiveness review

## Additional Resources

- [Sentry Alerts Documentation](https://docs.sentry.io/product/alerts/)
- [Sentry Metric Alerts](https://docs.sentry.io/product/alerts/alert-types/#metric-alerts)
- [Sentry Release Health](https://docs.sentry.io/product/releases/health/)
- [SIP Website Sentry Setup](https://github.com/sip-protocol/sip-website/blob/main/docs/SENTRY_SETUP.md)

---

**Last Updated:** 2025-12-04
**Maintained By:** SIP Protocol Team
**Review Frequency:** Quarterly or after major releases
