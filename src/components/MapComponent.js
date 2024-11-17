import React, { useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMapEvents,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import Draggable from 'react-draggable';
import { collection, doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase'; // Adjust the import path as needed

// Fix the default icon issue in Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const getCurrentTimeFormatted = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = ('0' + (now.getMonth() + 1)).slice(-2);
  const day = ('0' + now.getDate()).slice(-2);
  const hours = ('0' + now.getHours()).slice(-2);
  const minutes = ('0' + now.getMinutes()).slice(-2);
  const seconds = ('0' + now.getSeconds()).slice(-2);
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

const MapComponent = () => {
  const [markers, setMarkers] = useState([]);
  const [routeName, setRouteName] = useState('');

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

  // Function to reset markers
  const handleResetMarkers = () => {
    setMarkers([]);
  };

  // Function to handle marker field changes
  const handleMarkerChange = (index, field, value) => {
    setMarkers((prevMarkers) => {
      const newMarkers = [...prevMarkers];
      let updatedValue = value;
      if (field === 'lat' || field === 'lng') {
        updatedValue = parseFloat(value);
        if (isNaN(updatedValue)) {
          updatedValue = '';
        } else {
          updatedValue = parseFloat(updatedValue.toFixed(6));
        }
      }
      newMarkers[index] = {
        ...newMarkers[index],
        [field]: updatedValue,
      };
      return newMarkers;
    });
  };

  // Function to remove a marker
  const handleRemoveMarker = (index) => {
    setMarkers((prevMarkers) => {
      const newMarkers = [...prevMarkers];
      newMarkers.splice(index, 1);
      return newMarkers;
    });
  };

  // Function to save the route to Firestore
  const handleSaveRoute = async () => {
    if (!routeName) {
      alert('Please enter a route name.');
      return;
    }
    if (markers.length === 0) {
      alert('Please add markers to save the route.');
      return;
    }
    try {
      const routeDocRef = doc(collection(db, 'routes'), routeName);
      await setDoc(routeDocRef, { markers });
      alert('Route saved successfully!');
    } catch (error) {
      console.error('Error saving route: ', error);
      alert('Failed to save route.');
    }
  };

  // Function to load the route from Firestore
  const handleLoadRoute = async () => {
    if (!routeName) {
      alert('Please enter a route name.');
      return;
    }
    try {
      const routeDocRef = doc(collection(db, 'routes'), routeName);
      const docSnapshot = await getDoc(routeDocRef);

      if (docSnapshot.exists()) {
        setMarkers(docSnapshot.data().markers);
        alert('Route loaded successfully!');
      } else {
        alert('No route found with that name.');
      }
    } catch (error) {
      console.error('Error loading route: ', error);
      alert('Failed to load route.');
    }
  };

  // Function to delete the loaded route from Firestore
  const handleDeleteRoute = async () => {
    if (!routeName || markers.length === 0) {
      alert('Please load a route before trying to delete.');
      return;
    }
    try {
      const routeDocRef = doc(collection(db, 'routes'), routeName);
      await deleteDoc(routeDocRef);
      setMarkers([]);
      alert('Route deleted successfully!');
    } catch (error) {
      console.error('Error deleting route: ', error);
      alert('Failed to delete route.');
    }
  };

  // Function to handle marker drag end
  const handleMarkerDrag = (index, event) => {
    const { lat, lng } = event.target.getLatLng();
    setMarkers((prevMarkers) => {
      const newMarkers = [...prevMarkers];
      newMarkers[index] = {
        ...newMarkers[index],
        lat: parseFloat(lat.toFixed(6)),
        lng: parseFloat(lng.toFixed(6)),
      };
      return newMarkers;
    });
  };

  return (
    <div style={{ position: 'relative', height: '100vh' }}>
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
        {markers
          .filter((marker) => !isNaN(marker.lat) && !isNaN(marker.lng))
          .map((marker, idx) => (
            <Marker
              key={idx}
              position={[marker.lat, marker.lng]}
              draggable={true}
              eventHandlers={{
                drag: (event) => handleMarkerDrag(idx, event),

              }}
            >
              <Popup>
                Marker at {marker.lat.toFixed(6)}, {marker.lng.toFixed(6)}
                <br />
                Time: {marker.time}
              </Popup>
            </Marker>
          ))}
        {markers.length > 1 && (
          <Polyline
            positions={markers
              .filter((marker) => !isNaN(marker.lat) && !isNaN(marker.lng))
              .map((marker) => [marker.lat, marker.lng])}
          />
        )}
      </MapContainer>

      <Draggable>
        <div
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            width: '420px',
            padding: '10px',
            backgroundColor: '#f9f9f9',
            overflowY: 'auto',
            boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
            cursor: 'move',
            opacity: 0.9,
            zIndex: 1000,
          }}
        >
          <h3>Editor Pane</h3>
          <button onClick={handleResetMarkers} style={{ marginBottom: '10px' }}>
            Reset Markers
          </button>
          <h4>Route</h4>
          <div style={{ marginBottom: '10px' }}>
            <label htmlFor='routeName'>Name</label>
            <input
              type='text'
              id='routeName'
              value={routeName}
              onChange={(e) => setRouteName(e.target.value)}
              style={{ width: '40%', marginLeft: '10px' }}
            />
            <button style={{ marginLeft: '10px' }} onClick={handleSaveRoute}>
              Save
            </button>
            <button style={{ marginLeft: '10px' }} onClick={handleLoadRoute}>
              Load
            </button>
            <button style={{ marginLeft: '10px' }} onClick={handleDeleteRoute}>
              Delete
            </button>
          </div>

          {markers.length>0 ? <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              tableLayout: 'fixed',
            }}
          >
            <colgroup>
              <col style={{ width: '5%' }} />
              <col style={{ width: '25%' }} />
              <col style={{ width: '25%' }} />
              <col style={{ width: '35%' }} />
              <col style={{ width: '10%' }} />
            </colgroup>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '4px' }}>#</th>
                <th style={{ textAlign: 'left', padding: '4px' }}>Lat</th>
                <th style={{ textAlign: 'left', padding: '4px' }}>Lng</th>
                <th style={{ textAlign: 'left', padding: '4px' }}>Time</th>
                <th style={{ textAlign: 'left', padding: '4px' }}></th>
              </tr>
            </thead>
            <tbody>
              {markers.map((marker, idx) => (
                <tr key={idx}>
                  <td style={{ padding: '4px', verticalAlign: 'top' }}>
                    {idx + 1}
                  </td>
                  <td style={{ padding: '4px', verticalAlign: 'top' }}>
                    <input
                      type='number'
                      step='0.0001'
                      value={marker.lat !== '' ? marker.lat.toFixed(6) : ''}
                      onChange={(e) =>
                        handleMarkerChange(idx, 'lat', e.target.value)
                      }
                      style={{ width: '100%' }}
                    />
                  </td>
                  <td style={{ padding: '4px', verticalAlign: 'top' }}>
                    <input
                      type='number'
                      step='0.000001'
                      value={marker.lng !== '' ? marker.lng.toFixed(6) : ''}
                      onChange={(e) =>
                        handleMarkerChange(idx, 'lng', e.target.value)
                      }
                      style={{ width: '100%' }}
                    />
                  </td>
                  <td style={{ padding: '4px', verticalAlign: 'top' }}>
                    <input
                      type='text'
                      value={marker.time}
                      onChange={(e) =>
                        handleMarkerChange(idx, 'time', e.target.value)
                      }
                      style={{ width: '100%' }}
                    />
                  </td>
                  <td
                    style={{
                      padding: '4px',
                      verticalAlign: 'top',
                      textAlign: 'center',
                    }}
                  >
                    <button
                      onClick={() => handleRemoveMarker(idx)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'red',
                        cursor: 'pointer',
                        fontSize: '16px',
                      }}
                      title='Remove Marker'
                    >
                      &#10005;
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>:null}
          <p>
            Click on the map to add markers.
          </p>
          {markers.length > 1
           ? <p>
              Edit markers by dragging them, or by changing the values in the table above.
             </p>:null}
        </div>
      </Draggable>
    </div>
  );
};

export default MapComponent;
