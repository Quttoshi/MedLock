from typing import List

from fastapi import Depends, HTTPException, status

from app.dependencies.jwt import get_current_user
from app.models.user import User


def require_role(roles: List[str]):
    def checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action"
            )
        return current_user
    return checker
