# 2027 土耳其環線 · 19 天旅行手帖

Miffy 配色的手機旅行手帖，將原始簡報重新排為可直接閱讀的每日交通、景點、美食與住宿資訊。

- 日期：2027/9/24–10/12
- [網站](https://nibbles724bot.github.io/TravelTurkey2027/)
- [原始簡報](https://docs.google.com/presentation/d/1R3rRgthyyVZKir0g0Ztm9C8AtsBktX26/edit)
- 純靜態 HTML/CSS/JavaScript，可直接開啟 `index.html`，不需要安裝套件。外部地圖與來源需要網路。

## 閱讀與導覽

- 手機行程目錄使用日期與標題分行的面板，可直接跳到 19 天行程與城市、美食、交通資料。
- 交通方式、預估時間與班次說明分開顯示；正文維持 16px，另可在搜尋區放大文字。
- 景點、餐廳、住宿區域、沿途城市與交通起訖點提供 Google Maps 搜尋連結；不代表地址已核實或飯店已選定。
- 支援中英文地名、重音忽略、多關鍵字搜尋與命中標示；`/` 開啟搜尋，`Esc` 關閉手機搜尋。
- `?q=` 可保存搜尋詞；每日前後導覽與錨點網址可直接分享。
- 行前清單、字級與最近閱讀位置保存在目前瀏覽器，不會跨裝置同步。
- 已依要求移除收藏、複製連結按鈕與所有原始投影片縮圖，只有右上角保留原始簡報入口。首頁兔子插畫保留。
- 旅行資訊保留原稿內容與資料年份，這次排版更新沒有重新查核班次、價格或入境規則。

## 更新與驗證

編輯 `slides.json` 或 `scripts/build.py` 後重建網站：

```sh
python3 scripts/build.py
python3 scripts/validate.py
node --check app.js
```

本機預覽：

```sh
python3 -m http.server 8000
```

開啟 http://localhost:8000 。GitHub Pages 已設定從 `main` 根目錄自動部署。

`slides.json` 保留原稿擷取資料，`assets/slides/` 是先前版本的原稿圖像存檔，目前網站不再載入。歷史優化記錄見 [IMPROVEMENTS.md](IMPROVEMENTS.md)。
