declare module "nodemailer" {
    type TransportOptions = Record<string, unknown>;

    export function createTransport(options: TransportOptions): {
        sendMail: (options: Record<string, unknown>) => Promise<unknown>;
    };
}
