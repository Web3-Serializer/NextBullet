import httpx


def make_request(method, url, headers=None, body=None,
                 follow_redirects=True, timeout=10, proxy=None):
    try:
        with httpx.Client(
            verify=False, follow_redirects=follow_redirects,
            timeout=timeout, proxy=proxy,
        ) as client:
            resp = client.request(
                method, url, headers=headers or {},
                content=body if method.upper() not in ("GET", "HEAD") else None,
            )
            return resp.text, str(resp.status_code), dict(resp.headers), None
    except httpx.TimeoutException:
        return None, None, None, "timeout"
    except httpx.ConnectError:
        return None, None, None, "connection_error"
    except Exception as e:
        return None, None, None, str(e)
