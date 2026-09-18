My first Official GIS project done after a long few weeks, My project stems from an attempt to answer a question that's obvious if you've ever walked the streets of Pheonix, AZ.
Why do some parts of Pheonix feel hotter than others, and what actually causes it?
I pulled Landsat 9 satellite imagery over Phoenix and built two layers: one measuring actual surface temperature, and one measuring vegetation cover. Then I threw in land cover data to test the more common assumption — that pavement is the main driver of urban heat.
Turns out that's not quite right.
What I found:
What I compared to surface temperature	Correlation
Vegetation (citywide)	-0.65
Impervious surface %, urban land only	0.22
Vegetation, urban land only	-0.70
