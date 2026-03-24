def make_request(method, url, headers=None, body=None,
                 follow_redirects=True, timeout=10, proxy=None,
                 tls_lib='tls_client', client_id='chrome_120'):
    if tls_lib == 'curl_cffi':
        try:
            from curl_cffi import requests as curl_requests
            resp = curl_requests.request(
                method, url, headers=headers or {},
                data=body if method.upper() not in ("GET", "HEAD") else None,
                allow_redirects=follow_redirects, timeout=timeout,
                proxies={"http": proxy, "https": proxy} if proxy else None,
                impersonate=client_id or "chrome", verify=False,
            )
            return resp.text, str(resp.status_code), dict(resp.headers), None
        except ImportError:
            return None, None, None, "curl_cffi not installed"
        except Exception as e:
            return None, None, None, str(e)
    else:
        try:
            import tls_client
            session = tls_client.Session(client_identifier=client_id or "chrome_120")
            if proxy:
                session.proxies = {"http": proxy, "https": proxy}
            resp = session.execute_request(
                method=method, url=url, headers=headers or {},
                data=body if method.upper() not in ("GET", "HEAD") else None,
                allow_redirects=follow_redirects, timeout_seconds=timeout,
            )
            return resp.text, str(resp.status_code), dict(resp.headers), None
        except ImportError:
            return None, None, None, "tls_client not installed"
        except Exception as e:
            return None, None, None, str(e)
