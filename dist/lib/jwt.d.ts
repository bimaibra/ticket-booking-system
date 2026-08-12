export interface AccessTokenPayload {
    sub: number;
    username: string;
    role: string;
    type: 'access';
}
export interface RefreshTokenPayload {
    sub: number;
    type: 'refresh';
}
export declare function signAccessToken(payload: Omit<AccessTokenPayload, 'type'>): string;
export declare function signRefreshToken(payload: Omit<RefreshTokenPayload, 'type'>): string;
export declare function verifyAccessToken(token: string): AccessTokenPayload;
export declare function verifyRefreshToken(token: string): RefreshTokenPayload;
//# sourceMappingURL=jwt.d.ts.map