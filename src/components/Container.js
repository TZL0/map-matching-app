// Container.js
import React, { useState, useEffect, useRef } from 'react';
import MapComponent from './MapComponent';
import EditorPane from './EditorPane';

const Container = () => {
  const [markers, setMarkers] = useState([]);
  const [routeName, setRouteName] = useState('');
  const [simulationStates, setSimulationStates] = useState({ status: 'stopped' });
  const [simulationData, setSimulationData] = useState({
    items: [],
    activeStates: [],
    atIdx: -1,
  });
  const [committedSubroutes, setCommittedSubroutes] = useState([]);
  const [activeProvisionalSubroutes, setProvisionalSubroutes] = useState([]);
  const [allProvisionalSubroutes, setAllProvisionalSubroutes] = useState([]);
  const [showOriginalPolylines, setShowOriginalPolylines] = useState(true);
  const [routeLoaded, setRouteLoaded] = useState(false);

  // Add showMarkers state
  const [showMarkers, setShowMarkers] = useState(true);

  // Refs to keep track of the latest state values
  const simulationStatesRef = useRef(simulationStates);
  const simulationDataRef = useRef(simulationData);
  const committedSubroutesRef = useRef(committedSubroutes);

  // Ref to prevent multiple calls due to Strict Mode
  const hasSentRequestRef = useRef(false);

  // Update refs whenever state changes
  useEffect(() => {
    simulationStatesRef.current = simulationStates;
  }, [simulationStates]);

  useEffect(() => {
    simulationDataRef.current = simulationData;
  }, [simulationData]);

  useEffect(() => {
    committedSubroutesRef.current = committedSubroutes;
  }, [committedSubroutes]);

  // Function to reset markers
  const handleResetMarkers = () => {
    setMarkers([]);
    setCommittedSubroutes([]);
    setProvisionalSubroutes([]);
    setAllProvisionalSubroutes([]); // Reset allProvisionalSubroutes
    setShowOriginalPolylines(true);
    setSimulationData({
      items: [],
      activeStates: [],
      atIdx: -1,
    });
    setSimulationStates({ status: 'stopped' });
    hasSentRequestRef.current = false; // Reset the ref when simulation stops
  };

  // Function to handle simulation controls
  const dynamic_map_match = () => {
    if (simulationStates.status === 'stopped' || simulationStates.status === 'paused') {
      if (markers.length > 1) {
        setSimulationStates({ status: 'running' });
        if (simulationData.atIdx < 0) {
          const items = markers.map((marker) => ({
            coords: [marker.lat, marker.lng, new Date(marker.time)],
          }));
          setSimulationData((prev) => ({
            ...prev,
            atIdx: 0,
            items: items,
          }));
        }
      } else {
        alert('Not enough simulation data!');
      }
    } else if (simulationStates.status === 'running') {
      setSimulationStates({ status: 'paused' });
    }
  };

  const handleStop = () => {
    setSimulationStates({ status: 'stopped' });
    setSimulationData({
      items: [],
      activeStates: [],
      atIdx: -1,
    });
    setCommittedSubroutes([]);
    setProvisionalSubroutes([]);
    setAllProvisionalSubroutes([]); // Reset allProvisionalSubroutes
    setShowOriginalPolylines(false);
    hasSentRequestRef.current = false; // Reset the ref when simulation stops
  };

  useEffect(() => {
    if (!hasSentRequestRef.current && simulationStates.status === 'running') {
      if (simulationData.atIdx >= 0) {
        setShowOriginalPolylines(false);
        send_dynamic_map_matching_request(simulationData.atIdx);
        hasSentRequestRef.current = true; // Mark as called
      }
    } else if (simulationStates.status === 'stopped') {
      setShowOriginalPolylines(false);
      hasSentRequestRef.current = false; // Reset the ref when simulation stops
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simulationStates.status]);

  // Function to get the last points of all provisional subroutes
  const getLastPointsOfProvisionalSubroutes = () => {
    // Map through each provisional subroute and extract the last coordinate
    return activeProvisionalSubroutes
      ? activeProvisionalSubroutes.map((subroute) => {
          const lastCoord = subroute.coords[subroute.coords.length - 1];
          return {
            Lat: lastCoord[0],
            Lon: lastCoord[1],
            Idx: subroute.end_idx,
          };
        })
      : [];
  };

  const getLastPointOfCommittedSubroutes = () => {
    if (committedSubroutes.length > 0) {
      const lastSubroute = committedSubroutes[committedSubroutes.length - 1];
      const lastCoord = lastSubroute.coords[lastSubroute.coords.length - 1];
      return {
        Lat: lastCoord[0],
        Lon: lastCoord[1],
        Idx: lastSubroute.end_idx,
      };
    }
    return null;
  };

  const getAlternativeParents = () => {
    const lastCommitedPoint = getLastPointOfCommittedSubroutes();
    const lastProvisionalPoints = getLastPointsOfProvisionalSubroutes();
    return lastCommitedPoint
      ? [lastCommitedPoint, ...lastProvisionalPoints]
      : lastProvisionalPoints;
  };

  const send_dynamic_map_matching_request = async (i) => {
    if (i >= markers.length || simulationStatesRef.current.status !== 'running') {
      setSimulationStates({ status: 'stopped' });
      return;
    }

    const payloadContent = {
      active_states: simulationDataRef.current.activeStates || [],
      coordinates: {
        Idx: i,
        Lat: String(markers[i].lat),
        Lon: String(markers[i].lng),
        RegisteredTime: markers[i].time,
        Type: 'Route',
      },
      alternative_parents: getAlternativeParents(),
    };

    try {
      console.log(new Date(), 'Sending request for index:', i);
      const response = await fetch('http://localhost:8080/map_match_dynamic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadContent),
      });
      const data = await response.json();
      console.log('Request succeeded with JSON response:', data);

      // Extract the necessary data from the response
      const result = data;

      // Update activeStates and atIdx
      setSimulationData((prev) => ({
        ...prev,
        activeStates: result.active_states,
        atIdx: i + 1,
      }));

      // Update the ref to the latest simulationData
      simulationDataRef.current = {
        ...simulationDataRef.current,
        activeStates: result.active_states,
        atIdx: i + 1,
      };

      // Extract committed_idx from the response
      const committedIdx = result.committed_idx;

      // Process provisional subroutes and update states
      const provisionalSubroutes = result.provisional_subroutes.map((subroute) => {
        const coords = subroute.coordinates.coordinates.map((coord) => [
          parseFloat(coord.Lat),
          parseFloat(coord.Lon),
        ]);
        const start_idx = subroute.start_idx;
        const end_idx = subroute.end_idx;
        return {
          start_idx,
          end_idx,
          coords,
        };
      });

      // Update allProvisionalSubroutes and activeProvisionalSubroutes together
      setAllProvisionalSubroutes((prevAllProvisional) => {
        const newAllProvisional = [...prevAllProvisional, [i, provisionalSubroutes]];

        // Move provisional subroutes with end_idx <= committedIdx to committedSubroutes
        setProvisionalSubroutes((prevProvisional) => {
          let newProvisional = [];
          const committedSubroutesFromProvisional = [];

          prevProvisional.forEach((subroute) => {
            if (subroute.end_idx <= committedIdx) {
              committedSubroutesFromProvisional.push(subroute);
            } else {
              newProvisional.push(subroute);
            }
          });

          if (committedSubroutesFromProvisional.length > 0) {
            setCommittedSubroutes((prevCommitted) => [
              ...prevCommitted,
              ...committedSubroutesFromProvisional,
            ]);
          }

          // Remove overlapping provisional subroutes
          newProvisional = newProvisional.filter(
            (r) => r.end_idx <= provisionalSubroutes[0]?.start_idx
          );

          provisionalSubroutes.forEach((subroute) => {
            const { start_idx, end_idx, coords } = subroute;

            // Prepare parameters for getConnectionSubroute
            const committedSubroutesParam = committedSubroutesRef.current;
            const activeProvisionalSubroutesParam = newProvisional;

            if (
              start_idx === 0 ||
              activeProvisionalSubroutesParam[activeProvisionalSubroutesParam.length - 1]
                ?.end_idx === start_idx ||
              committedSubroutesParam[committedSubroutesParam.length - 1]?.end_idx === start_idx
            ) {
              newProvisional.push({
                start_idx,
                end_idx,
                coords,
              });
            } else {
              console.log(
                'Connection subroute needed for:',
                start_idx,
                end_idx,
                activeProvisionalSubroutesParam
              );
              const connectionSubroute = getConnectionSubroute(
                start_idx,
                newAllProvisional,
                activeProvisionalSubroutesParam,
                committedSubroutesParam
              );
              if (connectionSubroute) {
                // Remove overlapping provisional subroutes
                newProvisional = newProvisional.filter(
                  (r) => r.end_idx <= connectionSubroute[0].start_idx
                );

                // Remove overlapping committed subroutes
                setCommittedSubroutes((prevCommitted) =>
                  prevCommitted.filter((r) => r.end_idx <= connectionSubroute[0].start_idx)
                );

                console.log('Connection subroute found:', connectionSubroute);
                newProvisional.push(...connectionSubroute, {
                  start_idx,
                  end_idx,
                  coords,
                });
              } else {
                console.error('Connection subroute not found for:', start_idx);
              }
            }

            console.log('New provisional subroute:', start_idx, end_idx);
          });

          return newProvisional;
        });

        return newAllProvisional;
      });

      // Continue simulation if still running
      if (simulationStatesRef.current.status === 'running') {
        send_dynamic_map_matching_request(i + 1);
      }
    } catch (error) {
      console.error('Request failed:', error);
      alert('Request failed: ' + error);
      setSimulationStates({ status: 'stopped' });
    }
  };

  // Modified getConnectionSubroute function
  const getConnectionSubroute = (
    start_idx,
    allProvisionalSubroutesParam,
    activeProvisionalSubroutesParam,
    committedSubroutesParam
  ) => {
    console.log('Finding connection subroute for:', start_idx);
    console.log('All provisional subroutes:', allProvisionalSubroutesParam);
    console.log('Active provisional subroutes:', activeProvisionalSubroutesParam);

    // Flatten all provisional subroutes into a single array of subroutes
    const allSubroutes = allProvisionalSubroutesParam.flatMap(([requestIdx, subroutes]) => subroutes);

    // Find the subroute with the matching end_idx
    const connectionSubroute = allSubroutes.find(
      (subroute) => subroute.end_idx === start_idx
    );

    if (!connectionSubroute) {
      console.error('No connection subroute found for start_idx:', start_idx);
      return null;
    }

    const start_idx_of_connection = connectionSubroute.start_idx;
    console.log(
      start_idx_of_connection,
      activeProvisionalSubroutesParam[activeProvisionalSubroutesParam.length - 1]?.end_idx,
      committedSubroutesParam[committedSubroutesParam.length - 1]?.end_idx
    );
    console.log(activeProvisionalSubroutesParam);
    console.log(committedSubroutesParam);

    if (
      start_idx_of_connection === 0 ||
      activeProvisionalSubroutesParam[activeProvisionalSubroutesParam.length - 1]?.end_idx ===
        start_idx_of_connection ||
      committedSubroutesParam[committedSubroutesParam.length - 1]?.end_idx ===
        start_idx_of_connection
    ) {
      return [connectionSubroute];
    } else {
      const nextConnectionSubroute = getConnectionSubroute(
        start_idx_of_connection,
        allProvisionalSubroutesParam,
        activeProvisionalSubroutesParam,
        committedSubroutesParam
      );
      return nextConnectionSubroute
        ? [...nextConnectionSubroute, connectionSubroute]
        : [connectionSubroute];
    }
  };

  return (
    <div style={{ position: 'relative', height: '100vh' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px',
          backgroundColor: '#f9f9f9',
          zIndex: 1000,
        }}
      >
        <h1>Map Matching App</h1>
        <div>
          <button onClick={dynamic_map_match} style={{ marginRight: '10px' }}>
            {simulationStates.status === 'running'
              ? 'Pause'
              : simulationStates.status === 'paused'
              ? 'Continue Match'
              : 'Match Dynamically'}
          </button>
          <button onClick={handleStop}>Stop</button>
        </div>
      </header>

      <MapComponent
        markers={markers}
        setMarkers={setMarkers}
        committedSubroutes={committedSubroutes}
        provisionalSubroutes={activeProvisionalSubroutes}
        showOriginalPolylines={showOriginalPolylines}
        handleMarkerDrag={handleMarkerDrag}
        routeLoaded={routeLoaded}
        setRouteLoaded={setRouteLoaded}
        showMarkers={showMarkers}             // Pass showMarkers
        setShowMarkers={setShowMarkers}       // Pass setShowMarkers
      />

      <EditorPane
        markers={markers}
        setMarkers={setMarkers}
        showMarkers={showMarkers}             // Pass showMarkers
        setShowMarkers={setShowMarkers}       // Pass setShowMarkers to EditorPane
        routeName={routeName}
        setRouteName={setRouteName}
        handleResetMarkers={handleResetMarkers}
        setCommittedSubroutes={setCommittedSubroutes}
        setProvisionalSubroutes={setProvisionalSubroutes}
        setShowOriginalPolylines={setShowOriginalPolylines}
        setSimulationData={setSimulationData}
        setSimulationStates={setSimulationStates}
        routeLoaded={routeLoaded}
        setRouteLoaded={setRouteLoaded}
      />
    </div>
  );

  // Function to handle marker drag end
  function handleMarkerDrag(index, event) {
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
  }
};

export default Container;
