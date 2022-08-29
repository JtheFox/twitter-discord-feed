const gulp = require('gulp');
const zip = require('gulp-zip');

console.log('Creating deployment build in disc/function.zip, use `npm run deploy` after build completion');

gulp.src(['**/node_modules/**', 'index.js', '.env'])
		.pipe(zip('function.zip'))
		.pipe(gulp.dest('dist'))