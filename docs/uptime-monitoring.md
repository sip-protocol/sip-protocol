# Uptime Monitoring Guide

**Purpose:** Setup external uptime monitoring for all SIP Protocol services to detect downtime, performance issues, and service degradation.

**Last Updated:** 2025-12-04

---

## Service Recommendations

### 1. UptimeRobot (Recommended for Free Tier)

**Pros:**
- Free tier: 50 monitors, 5-minute intervals
- Simple setup, reliable alerts
- Public status pages
- Email, Slack, Discord, webhook integrations
- HTTP(S), ping, port, keyword monitoring

**Cons:**
- Basic UI/UX
- Limited advanced features on free tier

**Best for:** Basic uptime monitoring with generous free tier

**Signup:** https://uptimerobot.com

---

### 2. Better Stack (Better Uptime)

**Pros:**
- Beautiful UI/UX
- Incident management workflow
- Call rotations, on-call scheduling
- Free tier: 10 monitors, 30-second intervals
- Advanced alerting policies
- Status pages with custom domains

**Cons:**
- Lower monitor count on free tier
- Premium features require paid plan

**Best for:** Teams needing incident management and on-call scheduling

**Signup:** https://betterstack.com/uptime

---

### 3. Checkly

**Pros:**
- API monitoring (not just HTTP)
- Browser checks (Playwright-based)
- Multi-location checks
- Free tier: 5 checks, 5-minute intervals
- Programmatic monitoring (monitoring as code)

**Cons:**
- Limited free tier
- More complex setup

**Best for:** API-heavy applications needing advanced checks

**Signup:** https://www.checklyhq.com

---

## Endpoints to Monitor

### Production Services

| Endpoint | Type | Expected Response | Check Interval |
|----------|------|-------------------|----------------|
| `https://sip-protocol.org` | HTTP(S) | 200 OK | 5 minutes |
| `https://sip-protocol.org/api/health` | HTTP(S) | 200 OK, JSON response | 5 minutes |
| `https://docs.sip-protocol.org` | HTTP(S) | 200 OK | 5 minutes |

### Staging/Development (Optional)

| Endpoint | Type | Expected Response | Check Interval |
|----------|------|-------------------|----------------|
| `http://176.222.53.185:5002` | HTTP | 200 OK | 10 minutes |
| `http://176.222.53.185:5003` | HTTP | 200 OK | 10 minutes |

**Note:** Staging monitors are optional but useful for catching issues before production deployment.

---

## Alert Configuration

### Recommended Alert Channels

1. **Slack** (Primary)
   - Create dedicated `#uptime-alerts` channel
   - Immediate notification for downtime
   - Good for team visibility

2. **Email** (Secondary)
   - Send to team email or distribution list
   - Backup notification method

3. **Discord** (Alternative)
   - Similar to Slack, good for open-source projects
   - Supports webhook integrations

4. **PagerDuty** (On-Call - Optional)
   - For teams with on-call rotation
   - Escalation policies
   - Phone/SMS alerts

### Alert Thresholds

- **Downtime Alert:** Trigger after 2 consecutive failed checks (prevents false positives)
- **Recovery Alert:** Send when service is back online
- **Performance Alert:** Trigger if response time > 5 seconds (optional)

---

## Setup Instructions: UptimeRobot (Free Tier)

### Step 1: Create Account

1. Go to https://uptimerobot.com
2. Sign up with email (or GitHub OAuth)
3. Verify email address

### Step 2: Add Monitors

For each endpoint, create a monitor:

#### Monitor 1: Website (sip-protocol.org)

1. Click "Add New Monitor"
2. Configure:
   - **Monitor Type:** HTTP(s)
   - **Friendly Name:** SIP Website
   - **URL:** `https://sip-protocol.org`
   - **Monitoring Interval:** 5 minutes
   - **Monitor Timeout:** 30 seconds
   - **HTTP Method:** HEAD (faster) or GET
3. Click "Create Monitor"

#### Monitor 2: API Health Endpoint

1. Click "Add New Monitor"
2. Configure:
   - **Monitor Type:** HTTP(s)
   - **Friendly Name:** SIP API Health
   - **URL:** `https://sip-protocol.org/api/health`
   - **Monitoring Interval:** 5 minutes
   - **Monitor Timeout:** 30 seconds
   - **HTTP Method:** GET
   - **Keyword:** (Optional) Add keyword check for specific JSON field
3. Click "Create Monitor"

#### Monitor 3: Documentation Site

1. Click "Add New Monitor"
2. Configure:
   - **Monitor Type:** HTTP(s)
   - **Friendly Name:** SIP Docs
   - **URL:** `https://docs.sip-protocol.org`
   - **Monitoring Interval:** 5 minutes
   - **Monitor Timeout:** 30 seconds
   - **HTTP Method:** HEAD or GET
3. Click "Create Monitor"

### Step 3: Configure Alert Contacts

#### Email Alerts

1. Go to "My Settings" > "Alert Contacts"
2. Click "Add Alert Contact"
3. Select "E-mail"
4. Enter email address
5. Verify email
6. Set alert threshold: "Send notification when down"

#### Slack Integration

1. Go to your Slack workspace
2. Create channel: `#uptime-alerts`
3. Add Incoming Webhook:
   - Go to https://api.slack.com/apps
   - Create new app > "Incoming Webhooks"
   - Activate Incoming Webhooks
   - Add webhook to workspace
   - Select `#uptime-alerts` channel
   - Copy webhook URL
4. Back in UptimeRobot:
   - "My Settings" > "Alert Contacts"
   - "Add Alert Contact"
   - Select "Slack"
   - Paste webhook URL
   - Test connection

#### Discord Integration

1. Go to Discord server
2. Create channel: `#uptime-alerts`
3. Channel Settings > Integrations > Webhooks
4. Create webhook, copy URL
5. In UptimeRobot:
   - "My Settings" > "Alert Contacts"
   - "Add Alert Contact"
   - Select "Discord"
   - Paste webhook URL
   - Test connection

### Step 4: Apply Alert Contacts to Monitors

1. Go to each monitor
2. Click "Edit"
3. Under "Alert Contacts to Notify," select all relevant contacts
4. Save changes

### Step 5: Create Public Status Page (Optional)

1. Go to "Status Pages"
2. Click "Add New Status Page"
3. Configure:
   - **Friendly Name:** SIP Protocol Status
   - **Monitors to Show:** Select all monitors
   - **Custom Domain:** (Optional) `status.sip-protocol.org`
4. Save and publish
5. Share URL with users

---

## Advanced Configuration

### Keyword Monitoring (API Health)

For `/api/health` endpoint, add keyword check to ensure valid response:

1. Edit "SIP API Health" monitor
2. Enable "Keyword"
3. Enter keyword: `"status":"healthy"` (or whatever your health endpoint returns)
4. Save

This ensures the endpoint is not just returning 200 OK, but actually returning valid health data.

### Multi-Location Checks

UptimeRobot Pro supports multi-location checks (US, EU, Asia). This helps detect regional issues.

For free tier, use a single location (default is US-East).

### Response Time Alerts

1. Edit monitor
2. Enable "Monitor Timeout"
3. Set to 5000ms (5 seconds)
4. This will alert if response takes longer than 5 seconds

---

## Monitoring as Code (Advanced)

For teams preferring infrastructure as code, UptimeRobot has an API:

```bash
# Example: Create monitor via API
curl -X POST "https://api.uptimerobot.com/v2/newMonitor" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "api_key=YOUR_API_KEY" \
  -d "friendly_name=SIP Website" \
  -d "url=https://sip-protocol.org" \
  -d "type=1" \
  -d "interval=300"
```

**API Docs:** https://uptimerobot.com/api/

---

## Alternative: Checkly (API Monitoring)

If you need more advanced API monitoring (beyond simple HTTP checks):

### Step 1: Create Checkly Account

1. Go to https://www.checklyhq.com
2. Sign up with email or GitHub

### Step 2: Create API Check

1. Click "Create Check" > "API Check"
2. Configure:
   - **Name:** SIP API Health
   - **Request:** GET `https://sip-protocol.org/api/health`
   - **Assertions:** Add JSON path assertions
   - **Locations:** Select check locations
   - **Frequency:** 5 minutes
3. Save

### Step 3: Add Assertions

```javascript
// Example: Check JSON response
const response = await fetch('https://sip-protocol.org/api/health')
const data = await response.json()

expect(response.status).toBe(200)
expect(data.status).toBe('healthy')
expect(data.uptime).toBeGreaterThan(0)
```

### Step 4: Configure Alerts

1. Go to "Alert Settings"
2. Add Slack/Email/PagerDuty integration
3. Set alert rules

---

## Maintenance

### Regular Tasks

- **Weekly:** Review uptime reports, check for degradation patterns
- **Monthly:** Verify alert contacts are working (test alerts)
- **Quarterly:** Review monitor coverage, add new endpoints if needed

### When Adding New Services

1. Add monitor for new endpoint
2. Apply alert contacts
3. Update documentation
4. Test monitor (use "Force Check" in UptimeRobot)

---

## Incident Response Workflow

When you receive an uptime alert:

1. **Verify Issue:**
   - Check if it's a real outage or false positive
   - Visit the endpoint in browser
   - Check VPS status: `ssh core@176.222.53.185`

2. **Diagnose:**
   - Check Docker containers: `docker ps`
   - Check nginx logs: `sudo tail -f /var/log/nginx/error.log`
   - Check service logs: `docker logs <container>`

3. **Resolve:**
   - Restart service if needed: `docker compose restart <service>`
   - Fix configuration if needed
   - Verify recovery in UptimeRobot

4. **Post-Incident:**
   - Document issue in incident log
   - Update monitoring if needed (e.g., add new checks)
   - Share learnings with team

---

## Integration with Sentry

If using Sentry for error monitoring, correlate uptime data with error spikes:

1. When UptimeRobot alerts downtime, check Sentry for errors
2. Use Sentry's Release tracking to correlate deployments with issues
3. Set up Sentry alerts for error rate spikes

---

## Status Page Best Practices

If creating a public status page:

1. **Be Transparent:** Show historical uptime, don't hide incidents
2. **Update Promptly:** Post incident updates in real-time
3. **Post-Mortems:** Share learnings from major incidents (optional)
4. **Subscribe Option:** Allow users to subscribe to status updates
5. **Custom Domain:** Use `status.sip-protocol.org` for branding

---

## Cost Considerations

### Free Tier Limits

| Service | Free Monitors | Check Interval | Locations | Alerts |
|---------|--------------|----------------|-----------|--------|
| UptimeRobot | 50 | 5 min | 1 | Unlimited |
| Better Stack | 10 | 30 sec | Multiple | Unlimited |
| Checkly | 5 | 5 min | 1 | Limited |

**Recommendation:** Start with UptimeRobot free tier (50 monitors is more than enough for SIP Protocol).

### When to Upgrade

Consider paid plans when you need:
- **Faster checks:** < 5 minute intervals
- **Multi-location:** Check from multiple regions
- **Advanced features:** API monitoring, browser checks, incident management
- **SLA requirements:** 99.9% uptime guarantees

---

## Security Considerations

### Private Endpoints

For staging/internal endpoints (e.g., `http://176.222.53.185:5002`):

1. **Option 1:** Monitor from VPS itself using local monitoring (cron + curl)
2. **Option 2:** Use VPN or IP whitelist for external monitoring
3. **Option 3:** Skip monitoring for non-critical staging environments

### API Keys

If monitoring authenticated endpoints:

1. Create dedicated monitoring API key with read-only access
2. Store in UptimeRobot securely (supports HTTP authentication)
3. Rotate keys regularly

---

## Next Steps

1. **Choose Service:** UptimeRobot (recommended) or Better Stack
2. **Sign Up:** Create account and verify email
3. **Add Monitors:** All three production endpoints
4. **Configure Alerts:** Slack + Email
5. **Test:** Use "Force Check" to verify monitors work
6. **Create Status Page:** (Optional) Public status page
7. **Document:** Share status page URL with users

---

## Related Documentation

- **Deployment Guide:** `docs/deployment.md`
- **Monitoring Dashboard:** `docs/monitoring.md` (Sentry, Prometheus)
- **Incident Response:** `docs/incident-response.md` (TODO)

---

## Support

- **UptimeRobot Docs:** https://uptimerobot.com/help/
- **Better Stack Docs:** https://docs.betterstack.com/uptime/
- **Checkly Docs:** https://www.checklyhq.com/docs/

---

**Status:** Ready for implementation
**Estimated Setup Time:** 30 minutes
**Maintenance Time:** 5 minutes/week
