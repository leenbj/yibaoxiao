CREATE TABLE "ocr_configs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"provider" text DEFAULT 'tencent' NOT NULL,
	"secret_id" text NOT NULL,
	"secret_key" text NOT NULL,
	"region" text DEFAULT 'ap-guangzhou',
	"is_active" boolean DEFAULT false,
	"prefer_invoice_ocr" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "ocr_configs" ADD CONSTRAINT "ocr_configs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;