document.addEventListener('DOMContentLoaded', () => {
    const generateBtn = document.getElementById("generateBtn");
    const copyBtn = document.getElementById("copyBtn");
    const macInput = document.getElementById("macInput");
    const errorEl = document.getElementById("error");
    const passwordEl = document.getElementById("password");

    generateBtn.addEventListener("click", handleGenerate);
    copyBtn.addEventListener("click", copyToClipboard);

    async function handleGenerate() {
        const macRaw = macInput.value.trim();
        const normalized = normalizeMac(macRaw);
        const validationError = validateMac(normalized);

        errorEl.textContent = "";
        passwordEl.value = "";

        if (validationError) {
            errorEl.textContent = validationError;
            macInput.focus();
            return;
        }

        try {
            const result = await fetchPassword(normalized);

            // パスワード表示
            passwordEl.value = result.password;

            // JST変換した日時（今後表示・ログ用途で使える）
            if (result.timestamp) {
                console.log("生成日時(JST):", formatUtcToJst(result.timestamp));
            }

        } catch (err) {
            errorEl.textContent = err.message || "サーバー通信に失敗しました。";
            macInput.focus();
        }
    }

    async function fetchPassword(mac) {
        const response = await fetch(AppConfig.API_ENDPOINT, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ mac })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `通信エラー (${response.status})`);
        }

        const data = await response.json();

        if (!data.password) {
            throw new Error("パスワードが取得できませんでした。");
        }

        return data;
    }

    // --- ここが追加された「王道」部分 ---
    function formatUtcToJst(utcString) {
        return new Date(utcString).toLocaleString("ja-JP", {
            timeZone: "Asia/Tokyo"
        });
    }

    function validateMac(normalized) {
        if (!normalized) return "MACアドレスを入力してください。";
        if (normalized.length !== 12) return "MACアドレス長が不正です。";
        if (!/^[0-9A-F]{12}$/.test(normalized)) return "MACアドレスが16進数ではありません。";
        return "";
    }

    function normalizeMac(value) {
        if (value == null) return "";
        return String(value).replace(/[-:\.\s]/g, "").toUpperCase();
    }

    function copyToClipboard() {
        if (!passwordEl.value) {
            alert("パスワードがありません");
            return;
        }
        navigator.clipboard.writeText(passwordEl.value).then(() => {
            alert("クリップボードにコピーしました");
        }).catch(() => {
            alert("コピーに失敗しました");
        });
    }
});
