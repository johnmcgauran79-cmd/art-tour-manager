# Email Tracking Setup Guide

## Overview
Email tracking system has been implemented to monitor email delivery and opens for booking confirmations and bulk emails.

## Features Implemented

### 1. Database Tables
- **email_logs**: Stores all sent emails with booking and tour information
- **email_events**: Tracks delivery, opens, clicks, bounces, and complaints

### 2. Edge Functions
- **send-booking-confirmation**: Updated to log all sent emails to the database
- **resend-webhook**: New webhook handler to receive and process email events from Resend

### 3. Email Tracking Report
Located in Operations > Reviews and Checks > Reports > **Email Tracking**

**Metrics Displayed:**
- Total emails sent
- Delivery rate
- Open rate
- Bounce rate
- Individual email status (Sent, Delivered, Opened, Bounced)
- Last opened timestamp for each email

## Resend Configuration Required

### Step 1: Configure Webhook in Resend Dashboard

1. Go to [Resend Webhooks](https://resend.com/webhooks)
2. Click "Add Webhook"
3. Enter webhook URL: `https://upqvgtuxfzsrwjahklij.supabase.co/functions/v1/resend-webhook`
4. Select events to track:
   - ✅ Email Sent
   - ✅ Email Delivered
   - ✅ Email Delivery Delayed
   - ✅ Email Bounced
   - ✅ Email Complained (Spam)
   - ✅ Email Opened
   - ✅ Email Clicked

5. Copy the webhook signing secret (starts with "whsec_...")
6. This secret is already configured in your Lovable project as `RESEND_WEBHOOK_SECRET`

### Step 2: Enable Email Tracking in Resend

1. Go to [Resend Settings](https://resend.com/settings)
2. Under "Email" section, ensure:
   - ✅ **Track Opens** is enabled
   - ✅ **Track Clicks** is enabled (optional)

## How It Works

### Email Sending Flow
1. User sends booking confirmation or bulk emails
2. Edge function sends email via Resend API
3. Resend returns a message ID
4. Email is logged to `email_logs` table with message ID

### Event Tracking Flow
1. Resend detects email event (delivered, opened, etc.)
2. Resend sends webhook to your edge function
3. Webhook function verifies signature for security
4. Event is logged to `email_events` table
5. Report automatically shows updated metrics

### Security
- Webhook signature verification ensures only Resend can send events
- All email logs protected by Row Level Security (RLS)
- Only admins, managers, and booking agents can view tracking data

## Viewing Reports

### Access the Report
1. Go to any tour
2. Click **Operations** tab
3. Scroll to **Tour Operations Reports** section
4. Click **Email Tracking** tile

### Understanding the Metrics
- **Total Sent**: All emails sent for this tour
- **Delivered**: Successfully delivered to recipient's inbox
- **Opened**: Recipient opened the email (requires images enabled)
- **Open Rate**: Percentage of delivered emails that were opened
- **Bounced**: Failed delivery (invalid email address)

### Email Status Badges
- **Sent** (Gray): Email sent, awaiting delivery confirmation
- **Delivered** (Blue): Email successfully delivered
- **Opened** (Green): Recipient opened the email
- **Bounced** (Red): Email delivery failed

## Testing Email Tracking

1. Send a test booking confirmation email
2. Check your inbox and open the email
3. Wait 1-2 minutes for webhook to process
4. Refresh the Email Tracking report
5. You should see:
   - Email appears in the list
   - Status changes from "Sent" → "Delivered" → "Opened"
   - "Last Opened" timestamp updates

## Troubleshooting

### Emails showing as "Sent" but not "Delivered"
- Check Resend webhook is configured correctly
- Verify webhook secret matches
- Check edge function logs: Operations > Edge Functions > resend-webhook

### Open tracking not working
- Ensure "Track Opens" is enabled in Resend settings
- Note: Opens require recipient to load images in email
- Some email clients block tracking pixels

### No emails in tracking report
- Verify emails are being sent successfully
- Check that message_id is being returned by Resend
- Review send-booking-confirmation edge function logs

## Future Enhancements

Possible additions:
- Click tracking for links in emails
- Email campaign reports (group emails by date range)
- Bounce handling (mark customer emails as invalid)
- Resend failed deliveries
- Email templates performance comparison
- Export email reports to CSV
