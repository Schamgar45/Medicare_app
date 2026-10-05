from rest_framework.pagination import PageNumberPagination


class StandardPagination(PageNumberPagination):
    """Pagination par numéro de page.

    GET /api/patients/?page=2&page_size=50
    Réponse : {"count": 125, "next": "...", "previous": "...", "results": [...]}
    """

    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100
