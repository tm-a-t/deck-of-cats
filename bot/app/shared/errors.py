class AppError(Exception):
    """Base application error."""


class DomainError(AppError):
    """Business rule violation."""


class InvalidTransitionError(DomainError):
    """Illegal state transition in aggregate."""


class SecurityViolationError(AppError):
    """Unsafe or unauthorized action attempted."""


class NotFoundError(AppError):
    """Requested entity not found."""


class ConcurrencyError(AppError):
    """Optimistic lock or lease lock conflict."""


class ExternalIntegrationError(AppError):
    """Failure in external provider adapter."""
