# Generated by Django 3.2.5 on 2022-02-11 23:56

import django.db.models.deletion
from django.db import migrations, models

import posthog.models.utils


class Migration(migrations.Migration):

    dependencies = [
        ("posthog", "0205_auto_20220204_1748"),
    ]

    operations = [
        migrations.CreateModel(
            name="Tag",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=posthog.models.utils.UUIDT, editable=False, primary_key=True, serialize=False
                    ),
                ),
                ("name", models.CharField(max_length=255)),
                ("team", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="posthog.team")),
            ],
        ),
        migrations.CreateModel(
            name="TaggedItem",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=posthog.models.utils.UUIDT, editable=False, primary_key=True, serialize=False
                    ),
                ),
                (
                    "action",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="tagged_items",
                        to="posthog.action",
                    ),
                ),
                (
                    "tag",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE, related_name="tagged_items", to="posthog.tag"
                    ),
                ),
            ],
        ),
        migrations.AddConstraint(
            model_name="taggeditem",
            constraint=models.CheckConstraint(
                check=models.Q(models.Q(("action__isnull", False)), _connector="OR"), name="exactly_one_related_object"
            ),
        ),
        migrations.AlterUniqueTogether(name="taggeditem", unique_together={("tag", "action")},),
        migrations.AlterUniqueTogether(name="tag", unique_together={("name", "team")},),
    ]
