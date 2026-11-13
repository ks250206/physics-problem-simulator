# 検証記録

2026-11-14（日本時間）。初版コミット `4a5f2f6` はGitHub Actions上のNode.js 26 / pnpm 12で、物理テスト10項目・TypeScript型チェック・Vite+本番ビルド・Playwrightブラウザーテスト3項目・GitHub Pagesデプロイに成功。

初回実行: https://github.com/ks250206/physics-problem-simulator/actions/runs/43471577408

ブラウザーテストでは4シーンのWebGL表示、再生／リセット／コマ送り、各選択モード、パラメータ変更、共有URL再読込、CSVダウンロード、390pxスマートフォン幅での横溢れを確認。デスクトップ4枚とスマートフォン1枚の画像を `browser-evidence` artifactに保存（保存期間14日）。画像を目視確認し、モデルの画面占有率・ラベルの大きさ・軌跡バッファ・未使用ベクトルの非表示を改善。

追加した固定seedの160条件テストでは、質量比・曲面・初速度・落下高さ・固定条件をUI範囲内で変化させる。手元実行で最大規格化エネルギー収支誤差は約 `5.32e-7`。これは選んだ160条件の結果であり、全連続パラメータ域の誤差保証ではない。CIの許容値は `1e-5`。追加後は単体テスト合計11項目。

最新コミットの実行状態はActionsを参照: https://github.com/ks250206/physics-problem-simulator/actions

Pagesの公開成功と、リポジトリAboutの編集は別の操作。Aboutの説明・Website・Topicsを反映する管理者向けスクリプトは `scripts/configure-repo.sh`。GitHub Actionsの通常トークンにはリポジトリ管理権限を与えない。
