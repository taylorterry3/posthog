# Generated by Django 3.0.3 on 2020-04-04 11:45

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("posthog", "0039_populate_event_ip_property"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="event",
            name="ip",
        ),
    ]
