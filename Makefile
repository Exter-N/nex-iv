%.css: %.scss
	sass -I node_modules $< > $@

css-all: public/css/theme.css
