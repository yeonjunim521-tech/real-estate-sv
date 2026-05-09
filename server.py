"""
부동산 분석 PRO - 로컬 프록시 서버 (Python)
==============================================
이 서버는 두 가지 역할을 동시에 수행합니다:
1. 웹 서버: index.html, style.css, main.js 등 정적 파일을 서빙
2. 프록시 서버: /proxy?url=... 요청을 받아 국토부 API에 대신 요청 후 결과 전달
   → 브라우저의 CORS 보안 정책을 우회합니다.

사용법: python server.py  (그 후 브라우저에서 http://localhost:8000 접속)
"""
import http.server
import urllib.request
import urllib.parse
import json
import os

PORT = 8000  # 웹 브라우저에서 접속할 포트 번호

class ProxyHandler(http.server.SimpleHTTPRequestHandler):
    """
    웹 서버 + 프록시 서버를 겸하는 핸들러.
    - /proxy?url=... 로 들어오면 → 프록시 역할 (국토부 API 대신 호출)
    - 그 외 요청 → 일반 파일 서빙 (index.html 등)
    """

    def do_GET(self):
        try:
            # /proxy?url=... 패턴이면 프록시 모드로 동작
            if self.path.startswith('/proxy?'):
                self.handle_proxy()
            else:
                # 일반 파일 서빙 (index.html, style.css 등)
                super().do_GET()
        except (ConnectionAbortedError, ConnectionResetError):
            # 브라우저가 연결을 강제로 끊은 경우 (새로고침 등) 조용히 넘어감
            pass
        except Exception as e:
            print(f"[서버 오류] {e}")

    def handle_proxy(self):
        """국토부 API에 대신 요청을 보내고 결과를 브라우저에 전달하는 함수"""
        try:
            # URL에서 ?url= 파라미터 추출
            query = urllib.parse.urlparse(self.path).query
            params = urllib.parse.parse_qs(query)
            target_url = params.get('url', [None])[0]

            if not target_url:
                self.send_error(400, "url 파라미터가 필요합니다.")
                return

            # 국토부 API에 실제 요청 전송
            req = urllib.request.Request(target_url)
            req.add_header('User-Agent', 'Mozilla/5.0')
            
            with urllib.request.urlopen(req, timeout=15) as response:
                data = response.read()

            # 응답 시작
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'GET')
            self.end_headers()
            self.wfile.write(data)

        except (ConnectionAbortedError, ConnectionResetError):
            pass # 브라우저 중단 무시
        except Exception as e:
            # 에러 발생 시 JSON 형태로 에러 메시지 전달
            try:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                error_msg = json.dumps({"error": str(e)}, ensure_ascii=False)
                self.wfile.write(error_msg.encode('utf-8'))
            except:
                pass

    def end_headers(self):
        """모든 응답에 CORS 헤더를 추가하여 브라우저 차단 방지"""
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

    def log_message(self, format, *args):
        """콘솔에 요청 로그를 한글로 표시"""
        print(f"[서버] {args[0]}")

if __name__ == '__main__':
    # 서버 파일이 있는 폴더를 기준으로 실행
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    server = http.server.HTTPServer(('', PORT), ProxyHandler)
    print("")
    print("  ================================================")
    print("    [OK] Real Estate PRO Server Started!")
    print("")
    print(f"    Open browser: http://localhost:{PORT}")
    print("")
    print("    Press Ctrl+C to stop.")
    print("  ================================================")
    print("")
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[서버] 종료되었습니다.")
        server.server_close()
