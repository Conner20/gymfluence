declare module "@aws-sdk/client-s3" {
    export class S3Client {
        constructor(options?: Record<string, any>);
        send<T = unknown>(command: any): Promise<T>;
    }

    export class PutObjectCommand {
        constructor(input: Record<string, any>);
    }
}
