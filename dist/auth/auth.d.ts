export declare const auth: import("better-auth", { with: { "resolution-mode": "import" } }).Auth<{
    database: (options: import("better-auth", { with: { "resolution-mode": "import" } }).BetterAuthOptions) => import("better-auth", { with: { "resolution-mode": "import" } }).DBAdapter<import("better-auth", { with: { "resolution-mode": "import" } }).BetterAuthOptions>;
    basePath: string;
    secret: string | undefined;
    trustedOrigins: string[];
    emailAndPassword: {
        enabled: true;
        autoSignIn: false;
    };
    user: {
        additionalFields: {
            role: {
                type: "string";
                required: false;
                defaultValue: string;
                input: false;
            };
        };
    };
}>;
export type AuthSession = typeof auth.$Infer.Session;
