// html.js
export const HTML_CONTENT = `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>パスワード生成ツール</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { max-width: 400px; margin: 2em auto; font-size: 1.1em; font-family: sans-serif; padding: 0 1em; background: #f8f9fa; }
    h2 { font-size: 1.2em; margin-bottom: 1.5em; text-align: center; }
    label, input, button { display: block; width: 100%; margin-bottom: 0.8em; }
    input[type="text"] { padding: 0.5em; font-size: 1.1em; box-sizing: border-box; border: 1px solid #ccc; border-radius: 4px; background: #fff; }
    button { padding: 0.7em 0; font-size: 1.1em; border: none; border-radius: 4px; background: #007bff; color: #fff; margin-bottom: 1em; cursor: pointer; }
    button:active { background: #0056b3; }
    #error { color: #e74c3c; font-weight: bold; margin-bottom: 1em; text-align: center; min-height: 1.5em; }
    #password { background: #e9ecef; }
    @media (max-width: 480px) { body { max-width: 98vw; font-size: 1em; } }
  </style>
</head>
<body>
  <h2>OG4xx/OG8xx パスワード生成ツール</h2>
  <label for="macInput">MACアドレス：</label>
  <input type="text" id="macInput" size="20" autocomplete="off" placeholder="例）00:11:22:33:44:55">
  <button id="generateBtn">生成</button>
  <p id="error"></p>
  <label for="password">パスワード：</label>
  <input type="text" id="password" size="20" readonly>
  <button id="copyBtn">コピー</button>
  <script>
    const API_ENDPOINT = window.location.href;
    document.getElementById("generateBtn").addEventListener("click", handleGenerate);
    document.getElementById("copyBtn").addEventListener("click", copyToClipboard);

    async function handleGenerate() {
      const macInput = document.getElementById("macInput");
      const errorEl = document.getElementById("error");
      const passwordEl = document.getElementById("password");
      const macRaw = macInput.value.trim();
      
      errorEl.textContent = "";
      passwordEl.value = "";

      if (!macRaw) { errorEl.textContent = "MACアドレスを入力してください。"; return; }

      try {
        const formData = new FormData();
        formData.append("mac", macRaw);
        
        const response = await fetch(API_ENDPOINT, { method: "POST", body: formData });
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
           const text = await response.text();
           throw new Error("サーバーから不正な応答がありました。");
        }

        const data = await response.json();
        
        if (!response.ok || data.error) {
          throw new Error(data.error || "サーバーエラーが発生しました");
        }
        passwordEl.value = data.password;
        
      } catch (err) {
        errorEl.textContent = err.message;
      }
    }

    function copyToClipboard() {
      const pwd = document.getElementById("password");
      if (!pwd.value) return;
      navigator.clipboard.writeText(pwd.value).then(() => {
        alert("クリップボードにコピーしました");
      });
    }
  </script>
</body>
</html>
`;
