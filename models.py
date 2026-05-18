from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


@dataclass
class User:
    id: int
    name: str
    email: str
    created_at: datetime


@dataclass
class Transaction:
    id: int
    user_id: int
    type: str  # "earn" | "redeem"
    points: int
    amount_usd: float
    description: str
    created_at: datetime
    expires_at: Optional[datetime]


@dataclass
class PointsBalance:
    user_id: int
    total_points: int
    redeemable_points: int
    pending_expiry: int  # points expiring within 30 days

    @property
    def redeemable_usd(self) -> float:
        from service import POINTS_PER_DOLLAR
        return round(self.redeemable_points / POINTS_PER_DOLLAR, 2)
