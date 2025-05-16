export enum SizeUnit {
    PX = "px",
    EM = "em",
    REM = "rem",
    VH = "vh",
    VW = "vw",
    PERCENT = "%",
}

export interface Size {
    amount: number;
    unit: SizeUnit;
}

export function getSizeString(size: Size): string {
    return size.amount.toString() + size.unit;
}