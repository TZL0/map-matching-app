// EditorPane.js
import React, { useState, useEffect } from 'react';
import Draggable from 'react-draggable';
import { collection, doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase'; // Adjust the import path as needed

// Function to validate the time string
function isValidDateTime(dateTimeString) {
  // Regular expression to match the date and time format YYYY-MM-DD HH:MM:SS
  const dateTimeRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\s(0\d|1\d|2[0-3]):[0-5]\d:[0-5]\d$/;

  // Test the string against the regular expression
  if (!dateTimeRegex.test(dateTimeString)) {
    return false;
  }

  // Parse the date and time components
  const [datePart, timePart] = dateTimeString.split(' ');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes, seconds] = timePart.split(':').map(Number);

  // Check if the date is valid using Date object
  const date = new Date(year, month - 1, day, hours, minutes, seconds);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day &&
    date.getHours() === hours &&
    date.getMinutes() === minutes &&
    date.getSeconds() === seconds
  );
}

const EditorPane = ({
  markers,
  setMarkers,
  routeName,
  setRouteName,
  handleResetMarkers,
  setCommittedSubroutes,
  setProvisionalSubroutes,
  setShowOriginalPolylines,
  setSimulationData,
  setSimulationStates,
  routeLoaded,
  showMarkers,
  setShowMarkers,
  setRouteLoaded,
}) => {
  // Function to parse CSV data and set markers
  const parseCSVData = (csvData) => {
    const lines = csvData.trim().split('\n');
    const headers = lines[0].split(',');

    const idxIndex = headers.indexOf('idx');
    const timeIndex = headers.indexOf('time');
    const latIndex = headers.indexOf('lat');
    const lngIndex = headers.indexOf('lng');
    const altitudeIndex = headers.indexOf('altitude');

    if (
      idxIndex === -1 ||
      timeIndex === -1 ||
      latIndex === -1 ||
      lngIndex === -1 ||
      altitudeIndex === -1
    ) {
      alert('Invalid CSV format. Please ensure the headers are correct.');
      return;
    }

    const newMarkers = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === '') continue; // Skip empty lines
      const values = line.split(',');

      const idx = parseInt(values[idxIndex]);
      const time = values[timeIndex];
      const lat = parseFloat(values[latIndex]);
      const lng = parseFloat(values[lngIndex]);
      const altitude = parseFloat(values[altitudeIndex]);

      if (
        isNaN(idx) ||
        !isValidDateTime(time) ||
        isNaN(lat) ||
        isNaN(lng) ||
        isNaN(altitude)
      ) {
        alert(`Invalid data at line ${i + 1}. Please check the values.`);
        return;
      }

      newMarkers.push({
        lat: parseFloat(lat.toFixed(6)),
        lng: parseFloat(lng.toFixed(6)),
        time,
        altitude,
      });
    }

    setMarkers(newMarkers);
    setRouteLoaded(true);
  };

  // Function to handle uploading route from CSV
  const handleUploadRoute = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Reset markers and other states
      handleResetMarkers();

      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        parseCSVData(text);
      };
      reader.readAsText(file);

      // Reset the file input to allow uploading the same file again
      event.target.value = '';
    }
  };

  // Function to update a marker
  const handleMarkerUpdate = (index, updatedMarker) => {
    setMarkers((prevMarkers) => {
      const newMarkers = [...prevMarkers];
      newMarkers[index] = {
        ...newMarkers[index],
        ...updatedMarker,
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
        const loadedMarkers = docSnapshot.data().markers;
        setMarkers(loadedMarkers);
        setRouteLoaded(true); // Indicate that the route has been loaded
        setCommittedSubroutes([]);
        setProvisionalSubroutes([]);
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
    if (!routeName) {
      alert('Please enter a route name.');
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

  // MarkerRow Component
  const MarkerRow = ({ marker, index, handleMarkerUpdate, handleRemoveMarker }) => {
    const [latInput, setLatInput] = useState(marker.lat.toFixed(6));
    const [lngInput, setLngInput] = useState(marker.lng.toFixed(6));
    const [timeInput, setTimeInput] = useState(marker.time);

    const [prevLat, setPrevLat] = useState(marker.lat.toFixed(6));
    const [prevLng, setPrevLng] = useState(marker.lng.toFixed(6));
    const [prevTime, setPrevTime] = useState(marker.time);

    const [latError, setLatError] = useState(false);
    const [lngError, setLngError] = useState(false);
    const [timeError, setTimeError] = useState(false);

    useEffect(() => {
      setLatInput(marker.lat.toFixed(6));
      setLngInput(marker.lng.toFixed(6));
      setTimeInput(marker.time);
      setPrevLat(marker.lat.toFixed(6));
      setPrevLng(marker.lng.toFixed(6));
      setPrevTime(marker.time);
    }, [marker]);

    const handleLatBlur = () => {
      const updatedLat = parseFloat(latInput);

      if (isNaN(updatedLat) || updatedLat < -90 || updatedLat > 90) {
        setLatError(true);
        setTimeout(() => {
          setLatInput(prevLat);
          setLatError(false);
        }, 1000);
      } else {
        handleMarkerUpdate(index, {
          lat: parseFloat(updatedLat.toFixed(6)),
        });
        setPrevLat(updatedLat.toFixed(6));
      }
    };

    const handleLngBlur = () => {
      const updatedLng = parseFloat(lngInput);

      if (isNaN(updatedLng) || updatedLng < -180 || updatedLng > 180) {
        setLngError(true);
        setTimeout(() => {
          setLngInput(prevLng);
          setLngError(false);
        }, 1000);
      } else {
        handleMarkerUpdate(index, {
          lng: parseFloat(updatedLng.toFixed(6)),
        });
        setPrevLng(updatedLng.toFixed(6));
      }
    };

    const handleTimeBlur = () => {
      if (!isValidDateTime(timeInput)) {
        setTimeError(true);
        setTimeout(() => {
          setTimeInput(prevTime);
          setTimeError(false);
        }, 1000);
      } else {
        handleMarkerUpdate(index, {
          time: timeInput,
        });
        setPrevTime(timeInput);
      }
    };

    return (
      <tr key={index}>
        <td style={{ padding: '4px', verticalAlign: 'top' }}>{index + 1}</td>
        <td style={{ padding: '4px', verticalAlign: 'top' }}>
          <input
            type='number'
            step='0.000001'
            value={latInput !== '' ? latInput : ''}
            onChange={(e) => setLatInput(e.target.value)}
            onBlur={handleLatBlur}
            style={{
              width: '100%',
              borderColor: latError ? 'red' : undefined,
            }}
          />
        </td>
        <td style={{ padding: '4px', verticalAlign: 'top' }}>
          <input
            type='number'
            step='0.000001'
            value={lngInput !== '' ? lngInput : ''}
            onChange={(e) => setLngInput(e.target.value)}
            onBlur={handleLngBlur}
            style={{
              width: '100%',
              borderColor: lngError ? 'red' : undefined,
            }}
          />
        </td>
        <td style={{ padding: '4px', verticalAlign: 'top' }}>
          <input
            type='text'
            value={timeInput}
            onChange={(e) => setTimeInput(e.target.value)}
            onBlur={handleTimeBlur}
            style={{
              width: '100%',
              borderColor: timeError ? 'red' : undefined,
            }}
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
            onClick={() => handleRemoveMarker(index)}
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
    );
  };

  return (
    <Draggable bounds='parent'>
      <div
        style={{
          position: 'absolute',
          top: '70px',
          right: '10px',
          width: '420px',
          padding: '10px',
          backgroundColor: '#f9f9f9',
          boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
          cursor: 'move',
          opacity: 0.9,
          zIndex: 1000,
          maxHeight: '70%',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ flexShrink: 0 }}>
          <h3>Editor Pane</h3>
          <div style={{ marginBottom: '10px' }}>
            <button onClick={handleResetMarkers} style={{ marginRight: '10px' }}>
              Reset Markers
            </button>
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
            <label htmlFor='uploadRoute' style={{ marginRight: '10px', cursor: 'pointer' }}>
              <input
                type='file'
                id='uploadRoute'
                accept='.csv'
                style={{ display: 'none' }}
                onChange={handleUploadRoute}
              />
              <span style={{ textDecoration: 'underline', color: 'blue' }}>Upload Route</span>
            </label>
          </div>
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
        </div>

        {markers.length > 0 ? (
          <div
            style={{
              flexGrow: 1,
              overflowY: 'auto',
            }}
          >
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                tableLayout: 'fixed',
              }}
            >
              <colgroup>
                <col style={{ width: '10%' }} />
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
                  <MarkerRow
                    key={idx}
                    marker={marker}
                    index={idx}
                    handleMarkerUpdate={handleMarkerUpdate}
                    handleRemoveMarker={handleRemoveMarker}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <div style={{ flexShrink: 0 }}>
          <p>
            <b>Click</b> on the map to add markers.
          </p>
          {markers.length > 1 ? (
            <p>Edit markers by dragging them, or by changing the values in the table above.</p>
          ) : null}
        </div>
      </div>
    </Draggable>
  );
};

export default EditorPane;
