from app.dependencies.pagination import PaginationParams


def test_offset_is_zero_for_first_page() -> None:
    params = PaginationParams(page=1, page_size=50)

    assert params.offset == 0


def test_offset_advances_by_page_size() -> None:
    params = PaginationParams(page=3, page_size=20)

    assert params.offset == 40
