UPDATE email_templates
SET content_template = REPLACE(content_template, 'View Combined Host Report', 'Host Information Report')
WHERE type = 'host_pre_tour_briefing';