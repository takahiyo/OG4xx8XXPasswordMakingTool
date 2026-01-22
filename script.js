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
            const password = await fetchPassword(normalized);
            passwordEl.value = password;
        } catch (err) {
            errorEl.textContent = err.message || "サーバー通信に失敗しました。";
            macInput.focus();
        }
    }

    async function fetchPassword(mac) {
        const formData = new FormData();
        formData.append('mac', mac);

        // Configからエンドポイントを参照
        const response = await fetch(AppConfig.API_ENDPOINT, {
            method: "POST",
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `エラー: ${response.status}`);
        }

        const data = await response.json();
        if (!data.password) {
            throw new Error("パスワードが取得できませんでした。");
        }
        return data.password;
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
