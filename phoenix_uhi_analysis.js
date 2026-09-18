// Define Phoenix area of interest
var phoenix = ee.Geometry.Rectangle([-112.3, 33.2, -111.8, 33.7]);
Map.centerObject(phoenix, 10);
var phoenix = ee.Geometry.Rectangle([-112.3, 33.2, -111.8, 33.7]);

var landsat = ee.ImageCollection('LANDSAT/LC09/C02/T1_L2')
  .filterBounds(phoenix)
  .filterDate('2025-06-01', '2025-08-31')
  .filter(ee.Filter.lt('CLOUD_COVER', 10))
  .sort('CLOUD_COVER')
  .first();
Map.centerObject(phoenix, 10);
Map.addLayer(landsat, {bands: ['SR_B4','SR_B3','SR_B2'], min:0, max:20000}, 'True Color');var phoenix = ee.Geometry.Rectangle([-112.3, 33.2, -111.8, 33.7]);

var landsat = ee.ImageCollection('LANDSAT/LC09/C02/T1_L2')
  .filterBounds(phoenix)
  .filterDate('2025-06-01', '2025-08-31')
  .filter(ee.Filter.lt('CLOUD_COVER', 10))
  .sort('CLOUD_COVER')
  .first();

Map.centerObject(phoenix, 10);
Map.addLayer(landsat, {bands: ['SR_B4','SR_B3','SR_B2'], min:7000, max:15000, gamma:1.3}, 'True Color');
var lst = landsat.select('ST_B10').multiply(0.00341802).add(149.0).subtract(273.15);
Map.addLayer(lst.clip(phoenix), {min:25, max:50, palette:['040274','1725f2','21e5f5','43ff5e','f6ff47','ff8000','ff0000']}, 'Land Surface Temp (°C)');
var ndvi = landsat.normalizedDifference(['SR_B5','SR_B4']).rename('NDVI');
Map.addLayer(ndvi.clip(phoenix), {min:-0.2, max:0.6, palette:['brown','white','green']}, 'NDVI');
Map.addLayer(lst.clip(phoenix), {min:30, max:65, palette:['040274','1725f2','21e5f5','43ff5e','f6ff47','ff8000','ff0000']}, 'Land Surface Temp (°C)');
// Combine NDVI and LST into one image for sampling
var combined = ndvi.rename('NDVI').addBands(lst.rename('LST'));

// Sample points across Phoenix
var samples = combined.sample({
  region: phoenix,
  scale: 30,
  numPixels: 2000,
  geometries: true
});

// Print the first few to check it worked
print('Sample size:', samples.size());
print('First sample:', samples.first());

// Compute correlation between NDVI and LST
var correlation = samples.reduceColumns({
  reducer: ee.Reducer.pearsonsCorrelation(),
  selectors: ['NDVI', 'LST']
});
print('NDVI vs LST correlation:', correlation);
var nlcd = ee.Image('USGS/NLCD_RELEASES/2021_REL/NLCD/2021').select('landcover');
Map.addLayer(nlcd.clip(phoenix), {}, 'Land Cover 2021');
// Reclassify: mark developed classes (21-24) as 1, everything else as 0
var developed = nlcd.eq(21).or(nlcd.eq(22)).or(nlcd.eq(23)).or(nlcd.eq(24));

// Add to your combined image
var combined2 = combined.addBands(developed.rename('Developed'));

var samples2 = combined2.sample({
  region: phoenix,
  scale: 30,
  numPixels: 2000,
  geometries: true
});

var corrDevLST = samples2.reduceColumns({
  reducer: ee.Reducer.pearsonsCorrelation(),
  selectors: ['Developed', 'LST']
});
print('Developed vs LST correlation:', corrDevLST);
// Only count medium + high intensity development as "hot developed"
var denselyDeveloped = nlcd.eq(23).or(nlcd.eq(24));

var combined3 = combined.addBands(denselyDeveloped.rename('DenseDev'));

var samples3 = combined3.sample({
  region: phoenix,
  scale: 30,
  numPixels: 2000,
  geometries: true
});

var corrDense = samples3.reduceColumns({
  reducer: ee.Reducer.pearsonsCorrelation(),
  selectors: ['DenseDev', 'LST']
});
print('Dense development vs LST correlation:', corrDense);
print('Mean of DenseDev (proportion developed):', samples3.aggregate_mean('DenseDev'));
var nlcdCollection = ee.ImageCollection('USGS/NLCD_RELEASES/2021_REL/NLCD');
var nlcdFull = nlcdCollection.filter(ee.Filter.eq('system:index', '2021')).first();
var impervious = nlcdFull.select('impervious');

var combined4 = combined.addBands(impervious.rename('Impervious'));

var samples4 = combined4.sample({
  region: phoenix,
  scale: 30,
  numPixels: 2000,
  geometries: true
});

var corrImp = samples4.reduceColumns({
  reducer: ee.Reducer.pearsonsCorrelation(),
  selectors: ['Impervious', 'LST']
});
print('Impervious % vs LST correlation:', corrImp);
var landsatProjection = landsat.select('ST_B10').projection();

var imperviousAligned = impervious.reproject({
  crs: landsatProjection
});

var combined5 = combined.addBands(imperviousAligned.rename('Impervious'));

var samples5 = combined5.sample({
  region: phoenix,
  scale: 30,
  numPixels: 2000,
  geometries: true
});

var corrImp2 = samples5.reduceColumns({
  reducer: ee.Reducer.pearsonsCorrelation(),
  selectors: ['Impervious', 'LST']
});
print('Impervious (reprojected) vs LST correlation:', corrImp2);
print('Available NLCD images:', ee.ImageCollection('USGS/NLCD_RELEASES/2021_REL/NLCD').aggregate_array('system:index'));
// Add the raw NLCD landcover band so we can filter by it
var combined6 = combined5.addBands(nlcd.rename('LandcoverClass'));

var samples6 = combined6.sample({
  region: phoenix,
  scale: 30,
  numPixels: 3000,
  geometries: true
});

// Keep only "urban-relevant" land: developed (21-24) or developed open space,
// EXCLUDING natural desert classes like shrub/scrub (52), barren (31), grassland (71)
var urbanOnly = samples6.filter(
  ee.Filter.or(
    ee.Filter.rangeContains('LandcoverClass', 21, 24),  // all developed intensities
    ee.Filter.eq('LandcoverClass', 81),                  // pasture/hay (irrigated ag)
    ee.Filter.eq('LandcoverClass', 82)                   // cultivated crops
  )
);

print('Urban-only sample size:', urbanOnly.size());

var corrUrban = urbanOnly.reduceColumns({
  reducer: ee.Reducer.pearsonsCorrelation(),
  selectors: ['Impervious', 'LST']
});
print('Impervious vs LST (urban-only):', corrUrban);

// Also rerun NDVI vs LST on the same restricted sample for comparison
var corrNdviUrban = urbanOnly.reduceColumns({
  reducer: ee.Reducer.pearsonsCorrelation(),
  selectors: ['NDVI', 'LST']
});
print('NDVI vs LST (urban-only):', corrNdviUrban);
var tracts = ee.FeatureCollection('TIGER/2020/TRACT')
  .filterBounds(phoenix);

Map.addLayer(tracts, {color: 'white'}, 'Census Tracts', false);
print('Number of tracts in Phoenix area:', tracts.size());