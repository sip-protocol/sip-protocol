# Incident Response Runbook

**Project:** SIP Protocol
**Last Updated:** 2025-12-04
**Owner:** SIP Protocol Team

---

## Overview

This runbook provides step-by-step procedures for responding to production incidents affecting SIP Protocol services. Follow these procedures to minimize user impact, restore service quickly, and learn from incidents.

**Before You Start:**
- Remain calm and methodical
- Communicate status updates regularly
- Document actions taken for post-incident review
- When in doubt, escalate early

---

## Incident Severity Levels

| Level | Definition | Response Time | Examples |
|-------|------------|---------------|----------|
| **P0 - Critical** | Complete service outage or security breach affecting all users | Immediate (<5 min) | Website down, API completely unavailable, security breach, data loss |
| **P1 - High** | Major feature broken, affecting >50% of users | <15 minutes | Swap functionality broken, wallet connection failures, privacy features failing |
| **P2 - Medium** | Partial degradation, affecting <50% of users or specific features | <1 hour | High latency, single chain unavailable, quote API slow |
| **P3 - Low** | Minor issues, cosmetic problems, or single user reports | <4 hours | UI glitches, documentation errors, minor logging issues |

---

## On-Call Procedures

### Primary On-Call Engineer Responsibilities

1. **Monitor Alert Channels**
   - #alerts-critical (Slack/Discord)
   - Email notifications from Sentry
   - PagerDuty/Opsgenie pages

2. **Acknowledge Alerts Promptly**
   - Target: <5 minutes for P0/P1
   - Target: <15 minutes for P2/P3

3. **Initial Response Actions**
   - Assess severity
   - Post status update
   - Begin investigation
   - Escalate if needed

4. **Weekly Rotation**
   - Review open incidents from previous week
   - Check monitoring dashboard health
   - Verify alert channels working
   - Update runbooks with lessons learned

### Escalation Chain

| Role | Contact Method | Escalate After |
|------|----------------|----------------|
| Primary On-Call Engineer | PagerDuty | - |
| Secondary On-Call Engineer | PagerDuty | 15 minutes (P0/P1) |
| Senior Engineer | Phone + PagerDuty | 30 minutes |
| Engineering Manager | Phone | 45 minutes |
| CTO/Founder | Phone | 1 hour or security breach |

---

## Incident Response Workflow

### 1. Detection & Alerting

**You are notified via:**
- Sentry alert in #alerts-critical
- PagerDuty page
- User report via support channels
- Uptime monitoring alert

**First Actions:**
1. Acknowledge the alert (stop repeat notifications)
2. Check Sentry dashboard: https://sentry.io/organizations/sip-protocol/
3. Check status page (if available)
4. Verify incident is real (not false positive)

### 2. Initial Assessment (First 5 Minutes)

**Gather Context:**
```bash
# SSH into production VPS
ssh sip

# Check service status
cd ~/app
docker compose ps

# Check recent logs
docker compose logs --tail=100 --timestamps

# Check system resources
top
df -h
free -m
```

**Questions to Answer:**
- What is the user-facing impact?
- How many users are affected?
- When did the issue start?
- Is this related to a recent deployment?
- Are multiple services affected?

**Determine Severity:**
- Use the severity table above
- When in doubt, treat as higher severity

### 3. Communication

**Post Initial Status Update:**

Template for #incidents channel:
```
🚨 INCIDENT OPENED: [Short Description]

Severity: [P0/P1/P2/P3]
Start Time: [YYYY-MM-DD HH:MM UTC]
Affected Services: [website/api/docs]
User Impact: [description]
Engineer: @your-name

Status: Investigating
Next Update: [+15 min]
```

**Update Frequency:**
- P0: Every 15 minutes
- P1: Every 30 minutes
- P2: Every hour
- P3: When resolved

### 4. Investigation & Diagnosis

**Check Common Issues First:**

1. **Service Health**
   ```bash
   # Check if services are running
   docker compose ps

   # Check health endpoint
   curl http://localhost:5000/api/health
   curl http://localhost:5003/
   ```

2. **Recent Changes**
   ```bash
   # Check recent deployments
   git log --oneline -10

   # Check docker images
   docker images | grep sip
   ```

3. **Resource Exhaustion**
   ```bash
   # CPU, memory, disk
   top
   df -h
   free -m

   # Check disk I/O
   iostat -x 1 5
   ```

4. **Network Issues**
   ```bash
   # Check connectivity
   ping -c 3 1.1.1.1

   # Check DNS
   nslookup sip-protocol.org

   # Check nginx
   sudo systemctl status nginx
   sudo nginx -t
   ```

5. **Application Errors**
   ```bash
   # Check recent errors in logs
   docker compose logs --tail=500 | grep -i error

   # Check Sentry for error patterns
   # https://sentry.io/organizations/sip-protocol/issues/
   ```

**Investigation Checklist:**
- [ ] Services running?
- [ ] Health checks passing?
- [ ] Recent deployments?
- [ ] Resource exhaustion?
- [ ] Network connectivity?
- [ ] External dependencies down?
- [ ] Error patterns in logs?
- [ ] Similar past incidents?

---

## Common Incidents & Solutions

### 1. Website Down (P0)

**Symptoms:**
- Users report "Site cannot be reached"
- Uptime monitor alerts
- HTTP 502/503 errors

**Diagnosis:**
```bash
ssh sip
docker compose ps

# Check if container is running
docker ps | grep sip-website

# Check logs
docker compose logs sip-website --tail=100

# Check nginx
sudo nginx -t
sudo systemctl status nginx
```

**Solutions:**

**A. Container Crashed**
```bash
# Restart container
docker compose restart sip-website

# Verify health
curl http://localhost:5000/

# Check nginx proxy
curl https://sip-protocol.org
```

**B. OOM Killed (Out of Memory)**
```bash
# Check system memory
free -m

# Check docker stats
docker stats --no-stream

# Temporary fix: increase memory limit in docker-compose.yml
# Permanent fix: optimize application memory usage
```

**C. Failed Deployment**
```bash
# Check if new image is broken
docker compose logs sip-website | grep -i error

# Rollback to previous version (see Rollback section)
```

**D. Nginx Misconfiguration**
```bash
# Test nginx config
sudo nginx -t

# If broken, restore from backup
sudo cp /etc/nginx/sites-available/sip-protocol.org.backup \
       /etc/nginx/sites-enabled/sip-protocol.org

# Reload nginx
sudo systemctl reload nginx
```

**Verification:**
```bash
# Check site is up
curl -I https://sip-protocol.org

# Check from external monitor
# Use: https://downforeveryoneorjustme.com/sip-protocol.org
```

---

### 2. API Errors Spike (P1)

**Symptoms:**
- Sentry alert: "High Error Rate"
- Users report failed swaps/quotes
- 5xx errors in logs

**Diagnosis:**
```bash
ssh sip

# Check API service
docker compose logs sip-api --tail=200 | grep -i error

# Check Sentry for error details
# https://sentry.io/organizations/sip-protocol/issues/

# Check external API dependencies
curl https://api.1inch.dev/health  # Example
```

**Common Causes:**

**A. Downstream API Failure (NEAR Intents, 1inch, etc.)**
```bash
# Verify external service status
curl https://api.1inch.dev/swap/v6.0/1/health

# Check API rate limits
docker compose logs sip-api | grep -i "rate limit"

# Temporary: Enable fallback/mock mode if available
# Check .env for MOCK_MODE or FALLBACK_ENABLED
```

**B. Unhandled Exception in Code**
```bash
# Check Sentry for stack trace
# Identify failing endpoint

# Quick fix: Restart service (clears memory leaks)
docker compose restart sip-api

# If specific endpoint broken: consider feature flag disable
```

**C. Database/State Issue**
```bash
# SIP API is stateless, but check if cache or session storage broken
docker compose logs sip-api | grep -i "storage\|cache"

# Restart to clear any in-memory state
docker compose restart sip-api
```

**Mitigation:**
- If single endpoint broken, consider disabling via feature flag
- If external dependency down, communicate ETA to users
- If widespread, consider full rollback

---

### 3. High Latency / Slow Performance (P2)

**Symptoms:**
- Sentry alert: "Slow API Response Time"
- Users report site is slow
- Prometheus metrics show increased latency

**Diagnosis:**
```bash
ssh sip

# Check system load
uptime
top

# Check disk I/O
iostat -x 1 5

# Check network latency to external APIs
time curl https://api.1inch.dev/swap/v6.0/1/healthcheck

# Check application metrics
curl http://localhost:5000/metrics | grep duration
```

**Solutions:**

**A. High CPU/Memory Usage**
```bash
# Identify resource hog
docker stats

# Check for memory leaks
docker compose logs | grep -i "memory\|heap"

# Restart affected service
docker compose restart [service-name]
```

**B. Slow External API**
```bash
# Identify slow dependency
docker compose logs sip-api | grep -i "timeout\|slow"

# Check if rate-limited
curl -I https://api.1inch.dev/swap/v6.0/1/healthcheck

# Increase timeout temporarily (if appropriate)
# Or implement caching layer
```

**C. Network Issues**
```bash
# Check latency to external services
ping -c 10 api.1inch.dev

# Check VPS network
iftop  # requires installation

# Contact hosting provider if persistent
```

---

### 4. Database/Storage Issues (P1)

**Note:** SIP Protocol services are primarily stateless. This section applies if you've added state (Redis cache, database, etc.)

**Symptoms:**
- Errors mentioning database/storage
- Data inconsistencies
- Connection timeouts

**Diagnosis:**
```bash
ssh sip

# If using database container:
docker compose ps | grep -i db

# Check database logs
docker compose logs postgres  # or mysql, mongo, etc.

# Check disk space (common issue)
df -h
```

**Solutions:**

**A. Disk Space Full**
```bash
# Check disk usage
df -h

# Clear old logs
docker system prune -a

# Clear old Docker images
docker image prune -a

# If critical, contact hosting to expand disk
```

**B. Connection Pool Exhausted**
```bash
# Restart application to reset connections
docker compose restart sip-api

# Check connection limits in config
# Increase pool size if needed
```

**C. Data Corruption**
```bash
# Stop application
docker compose down

# Restore from backup (if available)
# See backup/restore procedures

# Restart
docker compose up -d
```

---

### 5. SSL Certificate Issues (P1)

**Symptoms:**
- Browser shows "Certificate expired"
- HTTPS not working
- Users report security warnings

**Diagnosis:**
```bash
ssh core  # or ssh sip with sudo

# Check certificate expiry
sudo certbot certificates

# Check nginx SSL config
sudo nginx -t
cat /etc/nginx/sites-enabled/sip-protocol.org | grep ssl
```

**Solutions:**

**A. Certificate Expired**
```bash
# Renew certificate
sudo certbot renew --nginx

# If auto-renew failed, renew manually
sudo certbot certonly --nginx -d sip-protocol.org -d www.sip-protocol.org

# Reload nginx
sudo systemctl reload nginx
```

**B. Certbot Service Down**
```bash
# Check timer
sudo systemctl status certbot.timer

# Restart timer
sudo systemctl restart certbot.timer
```

---

### 6. Privacy Features Failing (P1)

**Symptoms:**
- Sentry alert: "Privacy Feature Failures"
- Users can't generate stealth addresses
- Commitment/encryption errors

**Diagnosis:**
```bash
ssh sip

# Check for crypto library errors
docker compose logs | grep -i "stealth\|commitment\|crypto"

# Check Sentry for specific error messages
# https://sentry.io/organizations/sip-protocol/issues/
```

**Solutions:**

**A. Crypto Library Issue**
```bash
# Usually caused by version mismatch or corrupted build

# Rebuild and redeploy
cd ~/app
docker compose pull
docker compose up -d

# Verify crypto operations work
curl -X POST http://localhost:5000/api/v1/stealth/generate \
  -H "Content-Type: application/json" \
  -d '{"chainId": "solana"}'
```

**B. WASM Module Loading Failure**
```bash
# Check if WASM files accessible
curl https://sip-protocol.org/_next/static/wasm/

# Check Content-Type headers in nginx
sudo nginx -t
# Ensure WASM served with correct MIME type
```

---

### 7. Wallet Connection Failures (P1)

**Symptoms:**
- Sentry alert: "Wallet Connection Failures"
- Users report "Cannot connect wallet"
- Errors excluding user-rejected transactions

**Diagnosis:**
```bash
# Check browser console errors (ask user for screenshot)

# Check if RPC endpoints down
curl https://api.mainnet-beta.solana.com -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'

# Check CORS errors
docker compose logs sip-website | grep -i cors
```

**Solutions:**

**A. RPC Endpoint Down**
```bash
# Check status of blockchain RPC providers
# Solana: https://status.solana.com/
# Ethereum: Check Infura/Alchemy status

# If down, update RPC URL in .env
# Or use fallback RPC provider
```

**B. CORS Misconfiguration**
```bash
# Check docker-compose.yml
cat docker-compose.yml | grep CORS

# Should be explicit origins, not *
# Update and restart:
docker compose down
docker compose up -d
```

---

## Rollback Procedures

### When to Rollback

Rollback if:
- New deployment introduced critical bugs (P0/P1)
- Error rate increased >50% after deploy
- Unable to fix within 30 minutes
- Security vulnerability introduced

### Rollback Steps

**Option 1: Docker Tag Rollback (Fastest)**

```bash
ssh sip
cd ~/app

# Check current version
docker compose images

# Check available versions on GHCR
# https://github.com/sip-protocol/sip-website/pkgs/container/sip-website

# Edit docker-compose.yml to use previous tag
nano docker-compose.yml

# Change:
#   image: ghcr.io/sip-protocol/sip-website:latest
# To:
#   image: ghcr.io/sip-protocol/sip-website:sha-abc1234

# Pull old image and restart
docker compose pull
docker compose up -d

# Verify health
curl http://localhost:5000/
curl https://sip-protocol.org
```

**Option 2: Git Revert + Redeploy**

```bash
# In local development environment (not VPS)
cd /path/to/sip-website

# Find problematic commit
git log --oneline -10

# Revert commit (creates new commit)
git revert abc1234

# Push to trigger CI/CD
git push origin main

# Monitor GitHub Actions for deploy
# Or manually trigger deploy on VPS
```

**Option 3: Emergency Blue/Green Swap**

```bash
ssh sip
cd ~/app

# If you have blue/green containers configured:
# Switch nginx to point to old (stable) container

sudo nano /etc/nginx/sites-enabled/sip-protocol.org

# Change proxy_pass from:
#   proxy_pass http://localhost:5001;  # New (broken)
# To:
#   proxy_pass http://localhost:5000;  # Old (stable)

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

**Post-Rollback:**
1. Post status update: "Rolled back to stable version"
2. Continue investigating root cause
3. Fix issue in development
4. Test thoroughly before re-deploying
5. Document incident

---

## Escalation Matrix

### When to Escalate

| Situation | Escalate To | When |
|-----------|-------------|------|
| Can't diagnose in 15 min | Secondary On-Call | Immediately |
| P0 lasting >30 min | Senior Engineer | At 30 min mark |
| Security breach suspected | Security Lead + Manager | Immediately |
| Data loss possible | Engineering Manager | Immediately |
| Need production access | Ops Lead | When needed |
| External vendor issue | Vendor Relations | When confirmed |
| Legal/compliance concern | Legal Team | Immediately |

### How to Escalate

1. **Post in #incidents channel:**
   ```
   🔴 ESCALATING TO @senior-engineer

   Incident: [Link to incident thread]
   Reason: Unable to resolve in 30 minutes
   Impact: Website still down, ~1000 users affected
   Actions Taken:
   - Restarted services (no effect)
   - Checked logs (no clear error)
   - Attempted rollback (same issue)

   Need: Senior engineer assistance with diagnosis
   ```

2. **Page via PagerDuty/Opsgenie:**
   - Use "Escalate" button in PagerDuty
   - Add context in escalation notes

3. **Direct Contact (P0 only):**
   - Call phone number from on-call rotation doc
   - Send SMS if no answer within 2 minutes

---

## Post-Incident Review (PIR)

**Conduct within 48 hours of resolution for P0/P1 incidents.**

### PIR Template

```markdown
# Post-Incident Review: [Incident Title]

**Date:** YYYY-MM-DD
**Severity:** P0/P1/P2/P3
**Duration:** [Start Time] - [End Time] (Total: X hours)
**Responders:** @engineer1, @engineer2

## Summary

[2-3 sentence summary of what happened and impact]

## Impact

- Users affected: [number or percentage]
- Services down: [list]
- Revenue impact: [if applicable]
- Reputational impact: [if significant]

## Timeline

All times in UTC.

- **YYYY-MM-DD HH:MM** - Incident detected via [Sentry/user report/etc]
- **HH:MM** - On-call engineer acknowledged
- **HH:MM** - Initial investigation began
- **HH:MM** - Root cause identified: [description]
- **HH:MM** - Mitigation attempted: [action]
- **HH:MM** - Service restored
- **HH:MM** - Incident closed

## Root Cause

[Detailed technical explanation of what caused the incident]

## What Went Well

- [Thing that helped resolve quickly]
- [Effective monitoring/alerting]
- [Good communication]

## What Went Wrong

- [Things that slowed response]
- [Monitoring gaps]
- [Documentation issues]

## Action Items

| Action | Owner | Priority | Due Date |
|--------|-------|----------|----------|
| [Specific actionable task] | @engineer | High | YYYY-MM-DD |
| [Improve monitoring for X] | @engineer | Medium | YYYY-MM-DD |
| [Update runbook with Y] | @engineer | Low | YYYY-MM-DD |

## Lessons Learned

[Key takeaways for future incidents]
```

### PIR Meeting Agenda

1. **Review timeline** (5 min)
2. **Discuss root cause** (10 min)
3. **What went well** (5 min)
4. **What went wrong** (10 min)
5. **Action items** (10 min)
6. **Follow-up plan** (5 min)

**No Blame:** Focus on systems and processes, not individuals.

---

## Health Check Verification

After any incident resolution, verify all systems healthy:

```bash
# SSH into production
ssh sip

# Check all services running
docker compose ps

# Check health endpoints
curl http://localhost:5000/api/health          # Website
curl http://localhost:5003/                     # Docs
curl http://localhost:5000/api/v1/health       # API (if separate)

# Check external access
curl -I https://sip-protocol.org
curl -I https://docs.sip-protocol.org

# Check Sentry (no new errors)
# https://sentry.io/organizations/sip-protocol/issues/

# Check Prometheus metrics (no anomalies)
curl http://localhost:5000/metrics | grep -i error

# Check logs for warnings
docker compose logs --tail=100 | grep -i warn

# Monitor for 15 minutes before closing incident
```

**Checklist:**
- [ ] All containers running
- [ ] Health checks passing
- [ ] External URLs accessible
- [ ] No errors in Sentry (last 15 min)
- [ ] Metrics look normal
- [ ] No warnings in logs
- [ ] User reports stopped
- [ ] Status update posted

---

## Emergency Contacts

| Role | Name | Slack | Phone | Timezone |
|------|------|-------|-------|----------|
| Primary On-Call | [Rotation] | @oncall | [PagerDuty] | Varies |
| Secondary On-Call | [Rotation] | @oncall-backup | [PagerDuty] | Varies |
| Senior Engineer | [Name] | @senior-eng | +1-XXX-XXX-XXXX | UTC+X |
| Engineering Manager | [Name] | @eng-manager | +1-XXX-XXX-XXXX | UTC+X |
| CTO/Founder | [Name] | @cto | +1-XXX-XXX-XXXX | UTC+X |
| Ops/Infra Lead | [Name] | @ops | +1-XXX-XXX-XXXX | UTC+X |
| VPS Hosting Support | - | - | [Provider] | 24/7 |

**Update this table with actual contact information.**

---

## Quick Reference

### Key URLs

- Production website: https://sip-protocol.org
- Docs site: https://docs.sip-protocol.org
- Sentry: https://sentry.io/organizations/sip-protocol/
- GitHub Actions: https://github.com/sip-protocol/sip-website/actions
- GHCR Packages: https://github.com/orgs/sip-protocol/packages

### Key SSH Commands

```bash
# Access production VPS
ssh sip          # Application user (port 5000-5003)
ssh core         # Admin user (nginx, system)

# Common operations
cd ~/app
docker compose ps
docker compose logs --tail=100 --timestamps
docker compose restart [service]
docker compose down && docker compose up -d
```

### Service Ports

| Service | Port | Container Name | Domain |
|---------|------|----------------|--------|
| Website (blue) | 5000 | sip-website-blue | sip-protocol.org |
| Website (green) | 5001 | sip-website-green | - |
| Website (staging) | 5002 | sip-website-staging | - |
| Docs | 5003 | sip-docs | docs.sip-protocol.org |

### Emergency Commands

```bash
# STOP ALL SERVICES (nuclear option)
docker compose down

# START ALL SERVICES
docker compose up -d

# RESTART SPECIFIC SERVICE
docker compose restart sip-website

# ROLLBACK TO PREVIOUS IMAGE
# Edit docker-compose.yml, change :latest to :sha-abc1234
docker compose pull && docker compose up -d

# CHECK SYSTEM RESOURCES
top
df -h
free -m

# TAIL ALL LOGS
docker compose logs -f
```

---

## Runbook Updates

**This runbook should be updated:**
- After every P0/P1 incident (add lessons learned)
- Quarterly (review and improve)
- When infrastructure changes
- When new services added

**Update process:**
1. Create branch: `git checkout -b update-incident-runbook`
2. Edit this file
3. Test procedures in staging
4. Create PR for review
5. Merge and announce updates to team

---

**Last Updated:** 2025-12-04
**Next Review:** 2026-03-04
**Maintained By:** SIP Protocol Engineering Team

---

*May Allah guide us to resolve incidents swiftly and learn from each challenge. Tawakkul ala Allah.*
