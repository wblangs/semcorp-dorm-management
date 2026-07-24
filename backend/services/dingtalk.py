"""DingTalk 免登 (auto-login) helpers.

Flow: the frontend (inside DingTalk) obtains a one-time authCode via JSAPI,
posts it to /api/auth/dingtalk-login, and we exchange it here for the DingTalk
userid + display name using the app's client credentials.
"""
import json
import time
import urllib.error
import urllib.parse
import urllib.request

from fastapi import HTTPException

from backend.core.config import settings

# App access token cache (DingTalk tokens live ~2 hours).
_token_cache: dict = {"token": None, "expires_at": 0.0}


def is_configured() -> bool:
    return bool(settings.dingtalk_client_id and settings.dingtalk_client_secret and settings.dingtalk_corp_id)


def _http_get(url: str) -> dict:
    try:
        with urllib.request.urlopen(url, timeout=10) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.URLError as exc:
        raise HTTPException(status_code=502, detail=f"无法连接钉钉服务: {exc.reason}") from exc


def _http_post(url: str, payload: dict) -> dict:
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.URLError as exc:
        raise HTTPException(status_code=502, detail=f"无法连接钉钉服务: {exc.reason}") from exc


def _get_access_token() -> str:
    if not is_configured():
        raise HTTPException(status_code=400, detail="钉钉免登未配置")
    now = time.time()
    if _token_cache["token"] and _token_cache["expires_at"] > now + 60:
        return _token_cache["token"]
    query = urllib.parse.urlencode(
        {"appkey": settings.dingtalk_client_id, "appsecret": settings.dingtalk_client_secret}
    )
    data = _http_get(f"https://oapi.dingtalk.com/gettoken?{query}")
    if data.get("errcode") != 0:
        raise HTTPException(status_code=502, detail=f"钉钉获取凭证失败: {data.get('errmsg')}")
    _token_cache["token"] = data["access_token"]
    _token_cache["expires_at"] = now + int(data.get("expires_in", 7200))
    return data["access_token"]


def can_send_messages() -> bool:
    """Work notifications (工作通知) additionally require the app's AgentId."""
    return is_configured() and bool(settings.dingtalk_agent_id)


def send_work_message(userids: list[str], content: str) -> dict:
    """Send a DingTalk work notification (text) to the given DingTalk userids."""
    if not can_send_messages():
        raise HTTPException(status_code=400, detail="钉钉消息未配置（需要 DINGTALK_AGENT_ID 等环境变量）")
    if not userids:
        raise HTTPException(status_code=400, detail="没有可接收钉钉消息的用户")
    token = _get_access_token()
    data = _http_post(
        f"https://oapi.dingtalk.com/topapi/message/corpconversation/asyncsend_v2?access_token={urllib.parse.quote(token)}",
        {
            "agent_id": settings.dingtalk_agent_id,
            "userid_list": ",".join(userids),
            "msg": {"msgtype": "text", "text": {"content": content}},
        },
    )
    if data.get("errcode") != 0:
        raise HTTPException(status_code=502, detail=f"钉钉消息发送失败: {data.get('errmsg')}")
    return {"sent": True, "task_id": data.get("task_id")}


def get_user_by_auth_code(auth_code: str) -> dict:
    """Exchange a JSAPI authCode for {userid, name}."""
    token = _get_access_token()
    data = _http_post(
        f"https://oapi.dingtalk.com/topapi/v2/user/getuserinfo?access_token={urllib.parse.quote(token)}",
        {"code": auth_code},
    )
    if data.get("errcode") != 0:
        raise HTTPException(status_code=401, detail=f"钉钉免登失败: {data.get('errmsg')}")
    userid = data["result"]["userid"]

    name = None
    detail = _http_post(
        f"https://oapi.dingtalk.com/topapi/v2/user/get?access_token={urllib.parse.quote(token)}",
        {"userid": userid, "language": "zh_CN"},
    )
    if detail.get("errcode") == 0:
        name = (detail.get("result") or {}).get("name")
    return {"userid": userid, "name": name}
