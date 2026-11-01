# dispatchhub-web — Claude Code 向けの作業ルール

GitHub Pages で配信する管理ボード（board.html）のリポジトリです。
GAS 本体は別リポジトリ `mediclean0123-wq/dispatchhub`（ローカルでは `~/gas-dispatchhub/`）にあります。

## 作業ルール（必ず守る）
- **main に直接コミットしない**。ブランチで作業し、テストが通った変更だけを main に合流させる
- **GitHub Pages への公開（main への push）は main ブランチからのみ、黒木だけが行う**。push 前に必ず LINE で一言送る
- **clasp push・デプロイ更新・公開の前には、必ず止まってユーザーに確認する**
- **このリポジトリは公開リポジトリ**なので、`LIFF_ID` と `GAS_API_URL` 以外の秘密情報は絶対に上げない
- **access_token が写ったスクリーンショットは共有しない**
- 作業の前に `git pull`（ブランチのときは `git pull --rebase`）、作業のあとに commit して push する

## 報告
- ユーザーへの報告は日本語
- **調査・設計・修正案・実装・テスト結果は、毎回かならず GitHub のブランチに上げる。main には直接コミットしない。報告は dispatchhub リポジトリの `docs/reports/日付-題名.md` に書き、変更内容・原因・修正案・テスト結果・手でやること（1コマンド1行、先頭に「! 」）を入れる。push 後、ブランチ名・ファイルのパス・コミット番号を最後に必ず書く。push できない場合は、「! git push origin ブランチ名」の1行を出す。**
