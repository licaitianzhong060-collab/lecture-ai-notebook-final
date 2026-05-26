/* ==========================================================================
   JavaScript Application - Lecture AI Notebook (Gemini 3.5 Flash 本物通信版)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // Lucideアイコンの初期化
  lucide.createIcons();

  // DOM要素の取得
  const btnSettings = document.getElementById('btn-settings');
  const btnCloseSettings = document.getElementById('btn-close-settings');
  const panelSettings = document.getElementById('panel-settings');
  const inputApiKey = document.getElementById('input-api-key');
  const btnSaveKey = document.getElementById('btn-save-key');
  const keyStatusMsg = document.getElementById('key-status-msg');

  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const selectedFileCard = document.getElementById('selected-file-card');
  const fileNameDisplay = document.getElementById('file-name');
  const fileSizeDisplay = document.getElementById('file-size');
  const btnRemoveFile = document.getElementById('btn-remove-file');
  const btnGenerate = document.getElementById('btn-generate');
  const processingCard = document.getElementById('processing-card');

  const tabBtns = document.querySelectorAll('.tab-btn');
  const notebookPanels = document.querySelectorAll('.notebook-panel');
  const outputSummary = document.getElementById('output-summary');
  const outputTranscript = document.getElementById('output-transcript');
  const btnCopySummary = document.getElementById('btn-copy-summary');
  const btnCopyTranscript = document.getElementById('btn-copy-transcript');

  let selectedFile = null;

  // ==========================================
  // 1. APIキー管理（localStorage）
  // ==========================================
  
  // 初期ロード時に保存済みのキーを表示
  const savedKey = localStorage.getItem('gemini_api_key');
  if (savedKey) {
    inputApiKey.value = savedKey;
    showKeyStatus('キーが保存されています。すぐに文字起こし可能です！', 'success');
  }

  // 設定パネルの表示切り替え
  btnSettings.addEventListener('click', () => {
    panelSettings.classList.toggle('hidden');
  });

  btnCloseSettings.addEventListener('click', () => {
    panelSettings.classList.add('hidden');
  });

  // キーの保存処理
  btnSaveKey.addEventListener('click', () => {
    const key = inputApiKey.value.trim();
    if (key) {
      localStorage.setItem('gemini_api_key', key);
      showKeyStatus('APIキーをブラウザに保存しました！', 'success');
      setTimeout(() => { panelSettings.classList.add('hidden'); }, 1200);
    } else {
      localStorage.removeItem('gemini_api_key');
      showKeyStatus('APIキーを削除しました。', 'error');
    }
  });

  function showKeyStatus(message, type) {
    keyStatusMsg.textContent = message;
    keyStatusMsg.className = `status-msg ${type}`;
  }

  // ==========================================
  // 2. 音声ファイルのドラッグ＆ドロップ ＆ 選択
  // ==========================================

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
    }, false);
  });

  dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
      handleFileSelection(files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFileSelection(e.target.files[0]);
    }
  });

  function handleFileSelection(file) {
    if (!file.type.startsWith('audio/')) {
      alert('音声ファイル（mp3, wav, aac, m4a等）を選択してください。');
      return;
    }

    const MAX_SIZE_MB = 15;
    const fileSizeMB = file.size / (1024 * 1024);

    if (fileSizeMB > MAX_SIZE_MB) {
      alert(`ファイルサイズが大きすぎます (${fileSizeMB.toFixed(1)} MB)。15MB以下の音声ファイルを選択してください。`);
      return;
    }

    selectedFile = file;
    fileNameDisplay.textContent = file.name;
    fileSizeDisplay.textContent = `${fileSizeMB.toFixed(2)} MB`;
    
    dropZone.style.display = 'none';
    selectedFileCard.classList.remove('hidden');
    btnGenerate.disabled = false;
  }

  btnRemoveFile.addEventListener('click', () => {
    selectedFile = null;
    fileInput.value = '';
    dropZone.style.display = 'block';
    selectedFileCard.classList.add('hidden');
    btnGenerate.disabled = true;
  });

  // ==========================================
  // 3. 音声ファイルのBase64エンコード処理
  // ==========================================
  
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        // "data:audio/mp3;base64,SUQz..." からBase64部分のみを切り出す
        const base64Data = reader.result.split(',')[1];
        resolve({
          mimeType: file.type || 'audio/mp3',
          data: base64Data
        });
      };
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  }

  // ==========================================
  // 4. 本物のGemini API通信（Fetch API）
  // ==========================================

  btnGenerate.addEventListener('click', async () => {
    if (!selectedFile) return;

    // APIキーの取得とチェック
    const apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey) {
      alert('右上の ⚙️ アイコンからGemini APIキーを設定してください。');
      panelSettings.classList.remove('hidden');
      return;
    }

    // UIのローディング表示
    btnGenerate.disabled = true;
    processingCard.classList.remove('hidden');
    resetNotebook();

    try {
      // 1. 音声をBase64エンコード
      const base64Audio = await fileToBase64(selectedFile);

      // 2. Gemini APIへリクエスト送信
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;
      
      const promptText = `あなたは極めて優秀な講義アシスタントです。添付された講義またはスピーチの音声ファイルを注意深く聴き取り、以下の2つの指示に従って【日本語】で出力してください。

1. 【全文の文字起こし】:
音声から聞こえる言葉を一言一句、正確に書き起こしてください。話者の言い淀みや沈黙は適宜読みやすく整理して構いません。
このセクションは、必ず \`[TRANSCRIPT_START]\` と \`[TRANSCRIPT_END]\` の目印タグで囲んで出力してください。

2. 【整理された要約ノート】:
講義内容を誰が見ても理解できるように構造化してください。全体概要、重要なトピック（箇条書き）、決定事項や次アクション、および印象的な講師の引用などをマークダウン形式で美しく整理してください。
このセクションは、必ず \`[SUMMARY_START]\` と \`[SUMMARY_END]\` の目印タグで囲んで出力してください。

フォーマットの厳密な例:
[TRANSCRIPT_START]
（ここに正確な文字起こし文が入ります）
[TRANSCRIPT_END]

[SUMMARY_START]
（ここにマークダウン形式の美しい要約ノートが入ります）
[SUMMARY_END]`;

      const payload = {
        contents: [
          {
            parts: [
              { text: promptText },
              {
                inlineData: {
                  mimeType: base64Audio.mimeType,
                  data: base64Audio.data
                }
              }
            ]
          }
        ]
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Gemini APIとの通信に失敗しました。');
      }

      const result = await response.json();
      const responseText = result.candidates[0].content.parts[0].text;

      // 3. レスポンスから文字起こしと要約を分解抽出
      let transcript = '';
      let summary = '';

      const transcriptMatch = responseText.match(/\[TRANSCRIPT_START\]([\s\S]*?)\[TRANSCRIPT_END\]/);
      if (transcriptMatch) {
        transcript = transcriptMatch[1].trim();
      }

      const summaryMatch = responseText.match(/\[SUMMARY_START\]([\s\S]*?)\[SUMMARY_END\]/);
      if (summaryMatch) {
        summary = summaryMatch[1].trim();
      }

      // 切り出しタグに失敗した場合のインテリジェントなフォールバック
      if (!transcript && !summary) {
        summary = responseText;
        transcript = "文字起こしセクションの自動抽出に失敗しました。全体要約タブをご確認ください。\n\n" + responseText;
      } else {
        if (!transcript) transcript = "文字起こしデータの抽出に失敗しました。";
        if (!summary) summary = "要約データの抽出に失敗しました。\n\n" + responseText;
      }

      // 4. HTMLへのレンダリング
      outputSummary.innerHTML = marked.parse(summary);
      outputTranscript.textContent = transcript;

    } catch (error) {
      console.error('API Error:', error);
      showApiError(error.message);
    } finally {
      // ローディング終了
      processingCard.classList.add('hidden');
      btnGenerate.disabled = false;
    }
  });

  function resetNotebook() {
    outputSummary.innerHTML = `
      <div class="notebook-placeholder">
        <i data-lucide="edit-3"></i>
        <p>AIが考えを整理しています...</p>
      </div>`;
    outputTranscript.innerHTML = `
      <div class="notebook-placeholder">
        <i data-lucide="mic"></i>
        <p>音声をデコード中...</p>
      </div>`;
    lucide.createIcons();
  }

  function showApiError(message) {
    outputSummary.innerHTML = `
      <div class="notebook-placeholder" style="color: #dc2626;">
        <i data-lucide="alert-triangle" style="opacity: 1; color: #dc2626;"></i>
        <p style="font-weight: 600;">エラーが発生しました</p>
        <p class="sub" style="color: #ef4444; max-width: 80%; margin: 0 auto;">${message}</p>
        <p class="sub" style="margin-top: 1rem; color: var(--text-muted);">※APIキーが正しいか、ネットワーク接続、または音声ファイルの容量が15MB以下であることを再度ご確認ください。</p>
      </div>`;
    outputTranscript.textContent = `エラーのため文字起こしを読み込めませんでした。\n理由: ${message}`;
    lucide.createIcons();
  }

  // ==========================================
  // 5. ノートのタブ切り替え
  // ==========================================

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      notebookPanels.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetTab = btn.getAttribute('data-tab');
      document.getElementById(`panel-${targetTab}`).classList.add('active');
    });
  });

  // ==========================================
  // 6. クリップボードへのワンクリックコピー
  // ==========================================

  btnCopySummary.addEventListener('click', () => {
    const textToCopy = outputSummary.innerText;
    copyToClipboard(textToCopy, btnCopySummary);
  });

  btnCopyTranscript.addEventListener('click', () => {
    const textToCopy = outputTranscript.textContent;
    copyToClipboard(textToCopy, btnCopyTranscript);
  });

  function copyToClipboard(text, buttonElement) {
    if (!text || text.includes('音声ファイルを読み込み') || text.includes('エラーが発生しました')) {
      alert('コピーする有効なコンテンツがありません。');
      return;
    }

    navigator.clipboard.writeText(text).then(() => {
      const originalHTML = buttonElement.innerHTML;
      buttonElement.innerHTML = `<i data-lucide="check" style="color: #16a34a"></i> コピーしました！`;
      buttonElement.style.borderColor = '#16a34a';
      
      setTimeout(() => {
        buttonElement.innerHTML = originalHTML;
        buttonElement.style.borderColor = '';
        lucide.createIcons();
      }, 2000);
    }).catch(err => {
      alert('コピーに失敗しました: ', err);
    });
  }
});
