# 2027 土耳其環線 · 19 天旅行手帖

原始 Google Slides 的 40 頁 HTML 閱讀版本，保留原始版面與插圖，提供章節導覽、全文搜尋、逐頁永久連結、左右鍵切頁、文字閱讀及可點擊的參考連結。

- 旅行日期：2027/9/24–10/12
- [原始簡報](https://docs.google.com/presentation/d/1R3rRgthyyVZKir0g0Ztm9C8AtsBktX26/edit)
- 開啟 `index.html` 即可使用，不需要安裝套件、建置或網路連線；原始簡報和外部參考連結需要網路。
- 每日交通、景點、住宿預設以可選取文字顯示，手機內文至少 16px，不必放大橫向投影片。
- 手機頂端可直接選擇日期或章節，搜尋按需展開；餐廳、行程總覽及交通資料採直向排版。
- 展開「查看原始簡報」可對照原始頁面，點圖片可開啟 2000px 大圖。原稿中已合併為圖片的文字保留於圖像。
- `slides.json` 保存從原稿擷取的文字及連結；`assets/slides/` 保存各頁 WebP。
- 搜尋支援城市、景點、交通等文字；圖像內未提供文字層的內容不在搜尋範圍內。
- 原稿中的班次、票價與入境資訊保持原樣，並未重新查核或更新。

## 更新內容

編輯 `slides.json` 後執行 `python3 scripts/build.py`，即可重建已提交的靜態 `index.html`。產生器只使用 Python 標準函式庫，網站本身不需要執行 Python。

## 本機預覽

```sh
python3 -m http.server 8000
```

瀏覽 http://localhost:8000 。也可直接以瀏覽器開啟 `index.html`。

## GitHub Pages

這是純靜態網站。若要啟用 Pages，可在儲存庫 **Settings → Pages → Deploy from a branch** 選擇 `main` 與 `/ (root)`。目前已由 `main` 根目錄自動部署；推送更新後，GitHub Pages 會重新部署。
