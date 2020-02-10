const gulp = require('gulp');

// Pug
const pug = require('gulp-pug');
const fs = require('fs');
const data = require('gulp-data');
const path = require('path');

// CSS
const sass = require('gulp-sass');
const sassGlob = require('gulp-sass-glob');
const postcss = require('gulp-postcss');
const flexBugsFixes = require('postcss-flexbugs-fixes');
const autoprefixer = require('autoprefixer');
const cleanCSS = require('gulp-clean-css');

// js
const babel = require('gulp-babel');

// Image
const imagemin = require('gulp-imagemin');
const imageminMozjpeg = require('imagemin-mozjpeg');
const imageminPngquant = require('imagemin-pngquant');

// Utility
const cache = require('gulp-cached');
const changed = require('gulp-changed');
const browserSync = require('browser-sync');
const plumber = require('gulp-plumber');
const notify = require('gulp-notify');


/**
 * 開発用ディレクトリ
 */
const src = {
  root: 'src/',
  html: ['src/**/*.pug', '!src/**/_*.pug'],
  htmlWatch: 'src/**/*.pug',
  data: 'src/_data/',
  css: './src/assets/css/main.scss',
  cssWatch: 'src/**/*.scss',
  js: 'src/**/*.js',
  image: 'src/assets/img/**/*.{png,jpg,gif,svg,ico}',
  imageWatch: 'src/assets/img/**/*',
};
//　ここで指定したパスが↓dest時に引き継がれる

/**
 * 公開用ディレクトリ
 */
const dest = {
  root: 'htdocs/',
  image: 'htdocs/assets/img/',
  css: 'htdocs/assets/css/',
};


function html() {
  // JSONファイルの読み込み。
  const locals = {
    site: JSON.parse(fs.readFileSync(`${src.data}/site.json`)),
  };
  locals.ja = {
    // 日本語サイト
    site: JSON.parse(fs.readFileSync(`${src.data}ja/site.json`)),
  };
  // locals.en = {
  //   // 英語サイト
  //   site: JSON.parse(fs.readFileSync(`${src.data}en/site.json`)),
  // };
  return (
    gulp
      .src(src.html)
      .pipe(plumber({ errorHandler: notify.onError('Error: <%= error.message %>') }))
      .pipe(
        data(file => {
          // 各ページのルート相対パスを格納します。
          locals.pageAbsolutePath = `/${path
            .relative(file.base, file.path.replace(/.pug$/, '.html'))
            .replace(/index\.html$/, '')}`;
          return locals;
        }),
      )
      // .pipe(cache('html'))
      .pipe(
        pug({
          // `locals`に渡したデータを各Pugファイルで取得できます。
          locals,
          // ルート相対パスでincludeが使えるようにします。
          basedir: 'src',
          // Pugファイルの整形。
          pretty: true,
        }),
      )
      .pipe(gulp.dest(dest.root))
      .pipe(browserSync.reload({ stream: true }))
  );
}


/**
 * `.scss`を`.css`にコンパイルします。
 */
function css() {
  const plugins = [
    flexBugsFixes(),
    autoprefixer({ grid: 'autoplace' })
  ];
  return (
    gulp
      .src(src.css)
      // globパターンでのインポート機能を追加
      .pipe(sassGlob())
      .pipe(
        sass({
          outputStyle: 'expanded',
        }).on('error', sass.logError),
      )
      .pipe(plumber({ errorHandler: notify.onError('Error: <%= error.message %>') }))
      .pipe(postcss(plugins))
      .pipe(
        cleanCSS({
          // 圧縮せずに整形して出力する
          format: 'beautify',
          compatibility: {
            properties: {
              // 0の単位を不必要な場合は削除する
              zeroUnits: false,
            },
          },
        }),
      )
      .pipe(
        gulp.dest(dest.css),
      )
      .pipe(browserSync.reload({ stream: true }))
  );
}

// babel
function js() {
  return gulp
    .src(src.js)
    .pipe(plumber({
      errorHandler: notify.onError('Error: <%= error.message %>')
      }))
    .pipe(babel())
    .pipe(gulp.dest(dest.root))
}

/**
 * 画像を圧縮します。
 */
function image() {
  return gulp
    .src(src.image)
    .pipe(changed(dest.image))
    .pipe(
      plumber({
        errorHandler(err) {
          // eslint-disable-next-line no-console
          console.log(err.messageFormatted);
          this.emit('end');
        },
      }),
    )
    .pipe(
      imagemin([
        imageminMozjpeg({
          // 画質
          quality: 70,
        }),
        imageminPngquant({
          // 画質
          quality: [0.7, 0.8],
        }),
        imagemin.svgo({
          plugins: [
            // viewBox属性を削除する（widthとheight属性がある場合）。
            // 表示が崩れる原因になるので削除しない。
            { removeViewBox: false },
            // <metadata>を削除する。
            // 追加したmetadataを削除する必要はない。
            { removeMetadata: false },
            // SVGの仕様に含まれていないタグや属性、id属性やversion属性を削除する。
            // 追加した要素を削除する必要はない。
            { removeUnknownsAndDefaults: false },
            // コードが短くなる場合だけ<path>に変換する。
            // アニメーションが動作しない可能性があるので変換しない。
            { convertShapeToPath: false },
            // 重複や不要な`<g>`タグを削除する。
            // アニメーションが動作しない可能性があるので変換しない。
            { collapseGroups: false },
            // SVG内に<style>や<script>がなければidを削除する。
            // idにアンカーが貼られていたら削除せずにid名を縮小する。
            // id属性は動作の起点となることがあるため削除しない。
            { cleanupIDs: false },
          ],
        }),
        imagemin.optipng(),
        imagemin.gifsicle(),
      ]),
    )
    .pipe(gulp.dest(dest.image))
    .pipe(browserSync.reload({ stream: true }));
}

function serve(done) {
  browserSync({
    server: {
      baseDir: dest.root,
    },
    // 画面を共有するときにスクロールやクリックなどをミラーリングしたくない場合はfalseにします。
    ghostMode: false,
    // ローカルIPアドレスでサーバーを立ち上げます。
    open: 'external',
    // サーバー起動時に表示するページを指定します。
    startPath: '/',
    // falseに指定すると、サーバー起動時にポップアップを表示させません。
    notify: false,
  });
  done();
}


/**
 * ファイルを監視します。
 */
function watch() {
  gulp.watch(src.htmlWatch, html);
  gulp.watch(src.imageWatch, image);
  gulp.watch(src.cssWatch, css);
  gulp.watch(src.js, js);
}


/**
 * 開発タスクをすべて実行します。
 * ローカルサーバーを起動し、リアルタイムに更新を反映させます。
 */
exports.default = gulp.series(
  gulp.parallel(html, css, js, image),
  gulp.parallel(serve, watch),
);