// src/App.js
import React, { Component } from 'react';
import GoogleMap from 'google-map-react';
import axios from 'axios';
import Pusher from 'pusher-js';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const bound = 0.00478 * 1000 * 50

const mapStyles = {
  width: '100%',
  height: '100%',
}

const markerStyle = {
  height: '50px',
  width: '50px',
  marginTop: "-50px"
}

const imgStyle = {
  height: '100%',
}

const radiusStyle = {
  height: '100px',
  width: '100px',
  backgroundColor: '#bbb',
  opacity: '0.4',
  borderRadius: '50%',
  transform: 'translate(-50%, -50%)'
}

const Marker = ({ title }) => (
  <div style={markerStyle}>
    <img style={imgStyle} alt={title} src="https://res.cloudinary.com/og-tech/image/upload/s--OpSJXuvZ--/v1545236805/map-marker_hfipes.png" />
    <h3>{title}</h3>
  </div>
);

const Bomb = ({ title }) => (
  <div style={radiusStyle}>
    <img style={imgStyle} alt={title} src="/logo192.png" />
    <h3>{title}</h3>
  </div>
);

function getDistanceFromLatLonInKm(lat1,lon1,lat2,lon2) {
  var R = 6371; // Radius of the earth in km
  var dLat = deg2rad(lat2-lat1);  // deg2rad below
  var dLon = deg2rad(lon2-lon1); 
  var a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
    ; 
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  var d = R * c * 1000; // Distance in km
  return d;
}

function deg2rad(deg) {
  return deg * (Math.PI/180)
}

class App extends Component {
  constructor(props) {
    super(props)

    this.state = {
      center: { lat: 1.290270, lng: 103.851959 },
      locations: {},
      users_online: {},
      current_user: '',
      markers: {},
    }
  }

  componentDidMount() {
    let pusher = new Pusher('4ac58fe70485824b7315', {
      authEndpoint: "http://localhost:3128/pusher/auth",
      cluster: "ap1"
    });
    this.presenceChannel = pusher.subscribe('presence-channel');
    this.presenceChannel.bind('pusher:subscription_succeeded', members => {
      this.setState({
        users_online: members.members,
        current_user: members.myID
      });
      this.getLocation();
      this.notify();
    });

    this.presenceChannel.bind('location-update', body => {
      this.setState((prevState, props) => {
        const newState = { ...prevState };
        newState.locations[`${body.username}`] = body.location;
        return newState;
      });
    });

    this.presenceChannel.bind('bomb-update', body => {
      this.setState((prevState, props) => {
        const newState = { ...prevState };
        if (prevState.markers[`${body.username}`] === undefined){
          newState.markers[`${body.username}`] = [
            body.bombLocation
          ]
        }
        else {
          newState.markers[`${body.username}`] = [
            ...prevState.markers[`${body.username}`],
            body.bombLocation
          ]
        }
        newState.markers[`${body.username}`] = Array.from(new Set(newState.markers[`${body.username}`]))
        return newState;
      });
    })

    this.presenceChannel.bind('pusher:member_removed', member => {
      this.setState((prevState, props) => {
        const newState = { ...prevState };
        // remove member location once they go offline
        delete newState.locations[`${member.id}`];
        // delete member from the list of online users
        delete newState.users_online[`${member.id}`];

        return newState;
      })
      this.notify();
    })

    this.presenceChannel.bind('pusher:member_added', member => {
      this.notify();
    })
  }

  getLocation = () => {
    if (navigator && navigator.geolocation){
      navigator.geolocation.watchPosition(pos => {
        let location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        this.setState((prevState, props) => {
          let newState = { ...prevState };

          newState.center = location;
          newState.locations[`${prevState.current_user}`] = location;

          return newState;
        });
        console.log(location)
        var collided = false;
        for (let i = 0; i < Object.keys(this.state.markers).length; i++){
          let username = Object.keys(this.state.markers)[i]
          if (this.state.current_user == username){
            for (let j = 0; j < this.state.markers[`${username}`].length; j ++){
              console.log(getDistanceFromLatLonInKm(this.state.markers[`${username}`][j].position.lat, this.state.markers[`${username}`][j].position.lng, location.lat, location.lng))
              if (getDistanceFromLatLonInKm(this.state.markers[`${username}`][j].position.lat, this.state.markers[`${username}`][j].position.lng, location.lat, location.lng) < bound){
                collided = true
                break
              }
            }
          }
          if (collided){
            break
          }
        }
        if (collided){
          console.log("COLLIDED")
        }else{
          axios.post("http://localhost:3128/update-location", {
            username: this.state.current_user,
            location: location
          }).then(res => {
            if (res.status === 200) {
              console.log("new location updated successfully");
            }
          });
        }
      })
    } else {
      alert("Sorry, geolocation is not available on your device. You need that to use this app");
    }
  }

  notify = () => toast(`Users online : ${Object.keys(this.state.users_online).length}`, {
    position: "top-right",
    autoClose: 3000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
    type: 'info'
  });

  render() {
    var locationMarkers = Object.keys(this.state.locations).map((username, id) => {
      return (
        <Marker
          key={id}
          title={`${username === this.state.current_user ? 'My location' : username + "'s location"}`}
          lat={this.state.locations[`${username}`].lat}
          lng={this.state.locations[`${username}`].lng}
        >
        </Marker>
      );
    });

    var bombMarkers = []
    let curr_max = 0
    for (let i = 0; i < Object.keys(this.state.markers).length; i++){
      let username = Object.keys(this.state.markers)[i]
      bombMarkers.push(this.state.markers[`${username}`].map((marker, index) => {
        console.log(marker.position)
        return (
          <Bomb
            key={ curr_max + index }
            title={`${username === this.state.current_user ? 'My bomb' : username + "'s bomb"}`}
            name={marker.name}
            lat={marker.position.lat}
            lng={marker.position.lng}
          >
          </Bomb>
        )
      }))
      curr_max += this.state.markers[`${username}`].length
    }
    bombMarkers = bombMarkers.flat()

    console.log(bombMarkers)
    return (
      <div>
        <GoogleMap
          style={mapStyles}
          bootstrapURLKeys={{ key: 'WebKey' }}
          center={this.state.center}
          zoom={15}
          yesIWantToUseGoogleMapApiInternals
          onGoogleApiLoaded={({ map, maps }) => {
            map.setOptions({zoomControl: false, scrollwheel: false, disableDoubleClickZoom: true, minZoom: 15, maxZoom: 15});
            map.addListener('click', e => {
              const lat = e.latLng.lat()
              const lng = e.latLng.lng()
              axios.post("http://localhost:3128/update-bomb", {
                username: this.state.current_user,
                bomb: {
                  title: "",
                  name: "BOMB",
                  position: {lat:lat, lng:lng},
                }
              }).then(res => {
                if (res.status === 200) {
                  console.log("new bomb added successfully");
                }
              });
              console.log(lat, lng)
            })
          }}
        >
          {locationMarkers}
          {bombMarkers}
        </GoogleMap>
        <ToastContainer />
      </div>
    )
  }
}

export default App;
