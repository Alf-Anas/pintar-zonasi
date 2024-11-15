import { ObjectLiteral } from '@/types/object-literal.interface';
import { SpatialFileEnum } from '@/types/spatial-file.enum';
import dayjs from 'dayjs';
// @ts-ignore
import toGeoJSON from '@mapbox/togeojson';
import shp from 'shpjs';
import Maplibregl, { LngLatLike, MapGeoJSONFeature, MapMouseEvent } from 'maplibre-gl';
import * as turf from '@turf/turf';
import { BBOXType } from '@/types/bbox.type';

export const getDateTimeString = (eDate: string | null | undefined): string => {
    if (!eDate) return '';
    const inputDate = dayjs(eDate).format('YYYY-MM-DD HH:mm:ss');
    return inputDate;
};

export const getSpatialFileType = (file: File): SpatialFileEnum | null => {
    if (!file) return null;
    const validExtensions = [SpatialFileEnum.ZIP, SpatialFileEnum.KML, SpatialFileEnum.GEOJSON];

    // Get the file extension by splitting the filename and converting it to lowercase
    const fileExtension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase() as SpatialFileEnum;
    if (validExtensions.includes(fileExtension)) {
        return fileExtension;
    }
    return null;
};

export async function readGeojsonFile(inputFile: File): Promise<ObjectLiteral> {
    return new Promise((resolve, reject) => {
        if (inputFile && inputFile.name.endsWith('.geojson')) {
            const reader = new FileReader();

            reader.onload = (e) => {
                const fileContent = e.target?.result as string;

                try {
                    // Parse the GeoJSON file content
                    const geoJson = JSON.parse(fileContent);
                    resolve(geoJson);
                } catch (error) {
                    reject(error);
                }
            };

            // Read the file as text
            reader.readAsText(inputFile);
        } else {
            reject('Please upload a valid .geojson file.');
        }
    });
}

export async function readKmlFile(inputFile: File): Promise<ObjectLiteral> {
    return new Promise((resolve, reject) => {
        if (inputFile && inputFile.name.endsWith('.kml')) {
            const reader = new FileReader();

            reader.onload = (e) => {
                const fileContent = e.target?.result as string;

                try {
                    const parser = new DOMParser();
                    const kml = parser.parseFromString(fileContent, 'application/xml');

                    // Convert the KML to GeoJSON using togeojson library
                    const geoJson = toGeoJSON.kml(kml);
                    resolve(geoJson);
                } catch (error) {
                    reject(error);
                }
            };

            // Read the file as text
            reader.readAsText(inputFile);
        } else {
            reject('Please upload a valid .kml file.');
        }
    });
}

export async function readShpInZipFile(inputFile: File): Promise<ObjectLiteral> {
    return new Promise(async (resolve, reject) => {
        if (inputFile && inputFile.name.endsWith('.zip')) {
            try {
                const resData = await inputFile.arrayBuffer();
                const geoJson = await shp(resData);
                resolve(geoJson);
            } catch (error) {
                reject(error);
            }
        } else {
            reject('Please upload a valid .zip file.');
        }
    });
}

export const getGeojsonData = (inputFile: File): Promise<ObjectLiteral> => {
    return new Promise(async (resolve, reject) => {
        try {
            const spatialFile = getSpatialFileType(inputFile);

            if (spatialFile === SpatialFileEnum.GEOJSON) {
                const geojsonData = await readGeojsonFile(inputFile);
                resolve(geojsonData);
            } else if (spatialFile === SpatialFileEnum.KML) {
                const kmlData = await readKmlFile(inputFile);
                resolve(kmlData);
            } else if (spatialFile === SpatialFileEnum.ZIP) {
                const shpData = await readShpInZipFile(inputFile);
                resolve(shpData);
            } else {
                reject(new Error('Invalid spatial filetype'));
            }
        } catch (error) {
            reject(error);
        }
    });
};

export function getMapLibreCoordinate(
    e: MapMouseEvent & {
        features?: MapGeoJSONFeature[] | undefined;
    } & Object,
) {
    if (!e.features) return;
    // @ts-ignore
    const coordinates = e.features[0].geometry.coordinates.slice();
    while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
        coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
    }
    return {
        coordinates,
        properties: e.features[0].properties,
    };
}

export const extractLabelValueFromObj = (obj: Record<string, any>): any => {
    // List of prioritized keys to search for
    const preferredKeys = ['name', 'nama', 'nameobj', 'id', 'fid', 'objectid', 'description'];

    // Check if the object contains any of the preferred keys and return the corresponding non-falsy value
    for (const key of preferredKeys) {
        if (key in obj && obj[key]) {
            return obj[key]; // Return the value of the found key if it's not falsy
        }
    }

    // If none of the preferred keys are found, return the first non-falsy value from the object
    const firstNonFalsyKey = Object.keys(obj).find((key) => obj[key]); // Find the first key with a non-falsy value
    return firstNonFalsyKey ? obj[firstNonFalsyKey] : undefined;
};

export function propertiesTableDiv(props: ObjectLiteral) {
    const listRow: string[] = [];

    for (const key in props) {
        if (key === 'WKT_GEOMETRY' || key === 'ogc_fid') continue;
        if (props.hasOwnProperty(key)) {
            const row = `<tr style='${listRow.length % 2 === 0 ? 'background-color: #dddddd' : ''}'>
            <td>${key}</td>
            <td style='word-break: break-all'>${props[key]}</td>
          </tr>`;
            listRow.push(row);
        }
    }

    return `<table style='border: 1px solid #dddddd'>${listRow.join('')}</table>`;
}

export const getPolygonBoundingBox = (polygon: ObjectLiteral) => {
    const coordinates: [LngLatLike, LngLatLike][] = polygon[0];
    const bounds = coordinates.reduce(function (bounds, coord) {
        return bounds.extend(coord);
        // @ts-ignore
    }, new Maplibregl.LngLatBounds(coordinates[0], coordinates[0]));
    return bounds;
};

export function getBboxFromGeojson(geojsonData: ObjectLiteral) {
    if (!geojsonData) return null;
    try {
        const bbox = turf.bbox(geojsonData as turf.AllGeoJSON);
        return bbox;
    } catch (err) {
        return null;
    }
}

export const isWithinBbox = (lngLat: { lng: number; lat: number }, bbox: BBOXType) => {
    return lngLat.lng >= bbox[0] && lngLat.lng <= bbox[2] && lngLat.lat >= bbox[1] && lngLat.lat <= bbox[3];
};
