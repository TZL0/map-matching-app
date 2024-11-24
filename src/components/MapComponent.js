// MapComponent.js
import React, { useRef, useEffect } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMapEvents,
  Tooltip,
  useMap,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix the default icon issue in Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// Function to get the current time formatted
function getCurrentTimeFormatted() {
  const now = new Date();
  const year = now.getFullYear();
  const month = ('0' + (now.getMonth() + 1)).slice(-2);
  const day = ('0' + now.getDate()).slice(-2);
  const hours = ('0' + now.getHours()).slice(-2);
  const minutes = ('0' + now.getMinutes()).slice(-2);
  const seconds = ('0' + now.getSeconds()).slice(-2);
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

const MapComponent = ({
  markers,
  setMarkers,
  committedSubroutes,
  provisionalSubroutes,
  showOriginalPolylines,
  handleMarkerDrag,
  routeLoaded,
  setRouteLoaded,
  showMarkers,            // Receive showMarkers from props
  setShowMarkers,         // Receive setShowMarkers from props
}) => {
  // Create refs for each marker
  const markerRefs = useRef([]);

  // Effect to adjust marker opacity when showMarkers changes
  useEffect(() => {
    markerRefs.current.forEach((marker) => {
      if (marker) {
        marker.setOpacity(showMarkers ? 1 : 0.25);
      }
    });
  }, [showMarkers, markers]);

  // Function to handle map clicks and add markers
  const MapClickHandler = () => {
    useMapEvents({
      click(e) {
        const { latlng } = e;
        const newMarker = {
          lat: parseFloat(latlng.lat.toFixed(6)),
          lng: parseFloat(latlng.lng.toFixed(6)),
          time: getCurrentTimeFormatted(),
        };
        setMarkers((prevMarkers) => [...prevMarkers, newMarker]);
      },
    });
    return null;
  };

  // MapViewUpdater Component
  const MapViewUpdater = ({ markers, routeLoaded, setRouteLoaded }) => {
    const map = useMap();

    React.useEffect(() => {
      if (routeLoaded && markers.length > 0) {
        // Create a LatLngBounds object from the markers
        const bounds = L.latLngBounds(markers.map((marker) => [marker.lat, marker.lng]));

        // Adjust the map view to fit the bounds with some padding
        map.fitBounds(bounds, { padding: [50, 50], animate: true, duration: 0.5 });

        // Reset routeLoaded to prevent repeated adjustments
        setRouteLoaded(false);
      }
    }, [routeLoaded, markers, map, setRouteLoaded]);

    return null;
  };

  return (
    <div style={{ position: 'relative', height: 'calc(100% - 60px)' }}>
      {/* Add the button to toggle markers */}
      <button
        onClick={() => setShowMarkers((prev) => !prev)}
        style={{
          position: 'absolute',
          zIndex: 1000,
          top: 10,
          right: 10,
          padding: '5px 10px',
        }}
      >
        {showMarkers ? 'Hide Markers' : 'Show Markers'}
      </button>

      <MapContainer
        center={[34.0056365, -118.1658475]}
        zoom={11}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
          attribution='&copy; OpenStreetMap contributors'
        />
        <MapClickHandler />
        <MapViewUpdater
          markers={markers}
          routeLoaded={routeLoaded}
          setRouteLoaded={setRouteLoaded}
        />

        {/* Render markers and attach refs */}
        {markers
          .filter((marker) => !isNaN(marker.lat) && !isNaN(marker.lng))
          .map((marker, idx) => (
            <Marker
              key={idx}
              position={[marker.lat, marker.lng]}
              draggable={showMarkers}
              ref={(el) => {
                if (el) {
                  markerRefs.current[idx] = el;
                }
              }}
              eventHandlers={{
                drag: (event) => handleMarkerDrag(idx, event),
              }}
            >
              {showMarkers && (
                <>
                  <Tooltip direction='top' offset={[-14, -20]} permanent>
                    {idx + 1}
                  </Tooltip>
                  <Popup>
                    Marker at {marker.lat.toFixed(6)}, {marker.lng.toFixed(6)}
                    <br />
                    Time: {marker.time}
                  </Popup>
                </>
              )}
            </Marker>
          ))}

        {showOriginalPolylines && markers.length > 1 && (
          <Polyline
            positions={markers
              .filter((marker) => !isNaN(marker.lat) && !isNaN(marker.lng))
              .map((marker) => [marker.lat, marker.lng])}
          />
        )}
        {/* Render committed subroutes */}
        {committedSubroutes.map((subroute, idx) => (
          <Polyline
            key={`committed-${idx}`}
            positions={subroute.coords}
            color='purple'
            weight={5}
          />
        ))}
        {/* Render provisional subroutes */}
        {provisionalSubroutes.map((subroute, idx) => (
          <Polyline
            key={`provisional-${idx}`}
            positions={subroute.coords}
            color='purple'
            dashArray='5,10'
            weight={3}
          />
        ))}
      </MapContainer>
    </div>
  );
};

export default MapComponent;
