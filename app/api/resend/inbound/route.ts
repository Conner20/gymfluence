import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET;

export const POST = async (request: NextRequest) => {
    if (!WEBHOOK_SECRET) {
        console.error('Missing RESEND_WEBHOOK_SECRET env var');
        return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }

    try {
        const payload = await request.text();

        const id = request.headers.get('svix-id');
        const timestamp = request.headers.get('svix-timestamp');
        const signature = request.headers.get('svix-signature');

        if (!id || !timestamp || !signature) {
            return new NextResponse('Missing headers', { status: 400 });
        }

        await resend.webhooks.verify({
            payload,
            headers: {
                id,
                timestamp,
                signature,
            },
            webhookSecret: WEBHOOK_SECRET,
        });

        let event: any;
        try {
            event = JSON.parse(payload);
        } catch (err) {
            return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
        }

        let emailData: unknown = null;
        if (event?.type === 'email.received' && event?.data?.email_id) {
            const { data, error } = await resend.emails.receiving.get(event.data.email_id);
            if (error) {
                console.error('Resend receiving.get error', error);
            } else {
                emailData = data;
            }
        }

        return NextResponse.json({ received: true, event, email: emailData });
    } catch (error) {
        console.error('Inbound webhook error', error);
        return new NextResponse(`Error: ${error instanceof Error ? error.message : String(error)}`, {
            status: 500,
        });
    }
};
