class DomainError(Exception):
    def __init__(self, message: str = ""):
        self.message = message
        super().__init__(message)


class NotFoundError(DomainError):
    pass


class UserAlreadyExistsError(DomainError):
    pass


class UserDisabledError(DomainError):
    pass


class InvalidCredentialsError(DomainError):
    pass


class InsufficientPermissionsError(DomainError):
    pass


class InvalidTokenError(DomainError):
    pass
