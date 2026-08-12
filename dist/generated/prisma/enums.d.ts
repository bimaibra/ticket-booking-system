export declare const Role: {
    readonly USER: 'USER';
    readonly ADMIN: 'ADMIN';
};
export type Role = (typeof Role)[keyof typeof Role];
export declare const HoldStatus: {
    readonly ACTIVE: 'ACTIVE';
    readonly CONSUMED: 'CONSUMED';
    readonly EXPIRED: 'EXPIRED';
    readonly CANCELLED: 'CANCELLED';
};
export type HoldStatus = (typeof HoldStatus)[keyof typeof HoldStatus];
export declare const OrderStatus: {
    readonly PENDING: 'PENDING';
    readonly SUCCESS: 'SUCCESS';
    readonly EXPIRED: 'EXPIRED';
    readonly CANCELLED: 'CANCELLED';
};
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];
//# sourceMappingURL=enums.d.ts.map