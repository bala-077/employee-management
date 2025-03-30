import React, { useState, useEffect, useContext } from "react";
import {
  Paper,
  Grid,
  TextField,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  DialogTitle,
  Dialog,
  DialogContent,
  FormControl,
  DialogActions,
  TableBody,
  Container,
  Button,
  FormControlLabel,
  Checkbox,
  Select,
  MenuItem,
  CircularProgress,
  Typography,
} from "@material-ui/core";
import EditIcon from "@material-ui/icons/Edit";
import SaveIcon from "@material-ui/icons/Save";
import { useForm } from "./../../Custom-Hook/userForm";
import { fetchProjectDeveloper, checkToken } from "./../../Api/Users/Users";
import { fetchBooks } from "./../../Api/Books/Books";
import { useHistory } from "react-router";
import Alert from "@material-ui/lab/Alert";
import axios from "axios";
import { userData } from "../context/userContext";

function LeadAllocation() {
  const [editModal, setEditModal] = useState(false);
  const [projects, setProjects] = useState([]);
  const [alert, setAlert] = useState("");
  const [errorAlert, setErrorAlert] = useState("");
  const [processing, setProcessing] = useState(false);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const history = useHistory();
  const [TL, setTL] = useState([]);
  const [selectedDevelopers, setSelectedDevelopers] = useState([]);
  const { data } = useContext(userData);
  const [projectStages, setProjectStages] = useState({});
  const [Tls, setTls] = useState([]);
  const [storeData, setStoredata] = useState("");
  const [status, setStatus] = useState([]);
  const [fieldMismatches, setFieldMismatches] = useState([]);

  const getDatas = () => {
    const result = sessionStorage.getItem("user");
    
    if (result) {
      try {
        const { username } = JSON.parse(result);
        setStoredata(username);
      } catch (error) {
        console.error("Error parsing user data:", error);
        setErrorAlert("Failed to load user data");
      }
    } else {
      console.log("No user data found in sessionStorage");
      setErrorAlert("No user session found");
    }
  };

  const getTL = async () => {
    try {
      const response = await axios.get(
        "http://localhost:4000/api/allocate/get-allocation"
      );
      setTL(
        response.data.data.map((item) => ({
          projectName: item.projectname,
          teamLead: item.plname,
        }))
      );
      console.log(response, "project manager")
      setTls(response.data.data);
      setStatus(response.data.data, "reorehorfuhiiuhuihiuh");
    } catch (err) {
      console.error("Error fetching team leads:", err);
      setErrorAlert("Failed to fetch team allocation data");
    }
  };

  const checkBookFieldsOnStatusUpdate = () => {
    if (status.length > 0 && projects.length > 0) {
      const mismatches = [];
      
      status.forEach((statusItem) => {
        const matchingProject = projects.find(
          (project) => project.projectname === statusItem.projectname
        );
        
        if (matchingProject) {
          const fieldsToCompare = [
            'codinglanguage',
            'databasename',
            'duration',
            'description'
          ];
          
          const mismatchedFields = fieldsToCompare.filter(
            (field) => matchingProject[field] !== statusItem[field]
          );
          
          if (mismatchedFields.length > 0) {
            mismatches.push({
              projectName: statusItem.projectname,
              fields: mismatchedFields
            });
          }
        }
      });
      
      setFieldMismatches(mismatches);
      
      if (mismatches.length > 0) {
        console.warn("Field mismatches detected:", mismatches);
        setErrorAlert(`Field mismatches detected in ${mismatches.length} project(s)`);
      }
    }
  };

  useEffect(() => {
    getTL();
    getDatas();
    const fetchData = async () => {
      try {
        const tokenRes = await checkToken();
        if (tokenRes === undefined || tokenRes.status === 401) {
          history.push("/");
          return;
        }

        const [usersData, booksData] = await Promise.all([
          fetchProjectDeveloper(),
          fetchBooks(),
        ]);

        setUsers(usersData);
        setProjects(booksData);

        // Initialize project stages
        const stages = {};
        booksData.forEach((book) => {
          stages[book._id] = book.stage || "Start";
        });
        setProjectStages(stages);

        // Fetch team leads
        const leadRes = await axios.get("http://localhost:4000/api/allocate/get-lead");
        setTL(
          leadRes.data.data.map((item) => ({
            projectName: item.projectname,
            teamLead: item.plname,
          }))
        );
        setStatus(leadRes.data.data);
      } catch (error) {
        console.error("Error fetching data:", error);
        setErrorAlert("Failed to fetch required data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [history]);

  useEffect(() => {
    checkBookFieldsOnStatusUpdate();
  }, [status, projects]);

  const filterData = Tls.filter((item) => item.plname === storeData);

  const [bookForm, handleChange, setBookForm] = useForm({
    projectId: "",
    projectname: "",
    codinglanguage: "",
    databasename: "",
    duration: "",
    registerdate: "",
    description: "",
    plname: [],
    stage: "",
  });

  const handleDeveloperSelection = (event, developer) => {
    const developersSet = new Set(selectedDevelopers.map((dev) => dev.id));
    if (event.target.checked) {
      developersSet.add(developer.id);
    } else {
      developersSet.delete(developer.id);
    }
    setSelectedDevelopers(users.filter((user) => developersSet.has(user.id)));
  };

  const updateProject = async (e) => {
    e.preventDefault();
    if (selectedDevelopers.length === 0) {
      setErrorAlert("Please select at least one developer.");
      return;
    }

    try {
      const payload = {
        ...bookForm,
        plname: selectedDevelopers.map((dev) => dev.name),
        action: "add" // Added action parameter for backend
      };

      setProcessing(true);
      const response = await axios.post(
        "http://localhost:4000/api/allocate/createlead", 
        payload
      );
      
      setAlert("Project developers allocated successfully.");
      setEditModal(false);
      
      // Update local state with the response data
      const updatedProject = response.data;
      setTL(prevTL => [
        ...prevTL.filter(item => item.projectName !== updatedProject.projectname),
        {
          projectName: updatedProject.projectname,
          teamLead: updatedProject.plname
        }
      ]);
      
      setStatus(prevStatus => [
        ...prevStatus.filter(item => item.projectname !== updatedProject.projectname),
        updatedProject
      ]);
    } catch (err) {
      console.error("Error updating project:", err);
      setErrorAlert(err.response?.data?.error || "Error while allocating project developers.");
    } finally {
      setProcessing(false);
    }
  };

  const handleStageChange = async (projectId, stage) => {
    try {
      const project = projects.find((p) => p._id === projectId);
      if (!project) {
        throw new Error("Project not found");
      }

      const response = await axios.put(
        "http://localhost:4000/api/allocate/update-stage", 
        {
          stage,
          projectname: project.projectname,
        }
      );

      setProjectStages((prevStages) => ({
        ...prevStages,
        [projectId]: stage,
      }));

      // Update status data after stage change
      setStatus(prevStatus => 
        prevStatus.map(item => 
          item.projectname === project.projectname 
            ? { ...item, stage } 
            : item
        )
      );

      setAlert("Project stage updated successfully.");
    } catch (err) {
      console.error("Error updating stage:", err);
      setErrorAlert(err.response?.data?.error || "Error while updating project stage.");
    }
  };

  const getStageColor = (stage) => {
    switch (stage) {
      case "Start":
        return "#FFCCCB";
      case "Process":
        return "#ADD8E6";
      case "Testing":
        return "#FFD700";
      case "Deployment":
        return "#87CEEB";
      case "Finish":
        return "#90EE90";
      default:
        return "#FFFFFF";
    }
  };

  const editDialog = (
    <Dialog 
      open={editModal} 
      onClose={() => {
        setEditModal(false);
        setSelectedDevelopers([]);
      }} 
      fullWidth
      maxWidth="md"
    >
      <form onSubmit={updateProject}>
        <DialogTitle>Edit Project</DialogTitle>
        <DialogContent>
          <Container>
            {errorAlert && (
              <Alert severity="error" onClose={() => setErrorAlert("")}>
                {errorAlert}
              </Alert>
            )}
            {alert && (
              <Alert severity="success" onClose={() => setAlert("")}>
                {alert}
              </Alert>
            )}

            <TextField name="id" value={bookForm.id} type="hidden" />

            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Project Name"
                  name="projectname"
                  value={bookForm.projectname}
                  onChange={handleChange}
                  fullWidth
                  margin="normal"
                  disabled
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Coding Language"
                  name="codinglanguage"
                  value={bookForm.codinglanguage}
                  onChange={handleChange}
                  fullWidth
                  margin="normal"
                  disabled
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Database Name"
                  name="databasename"
                  value={bookForm.databasename}
                  onChange={handleChange}
                  fullWidth
                  margin="normal"
                  disabled
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Duration"
                  name="duration"
                  value={bookForm.duration}
                  onChange={handleChange}
                  fullWidth
                  margin="normal"
                  disabled
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Register Date"
                  name="registerdate"
                  value={bookForm.registerdate}
                  onChange={handleChange}
                  fullWidth
                  margin="normal"
                  disabled
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Description"
                  name="description"
                  value={bookForm.description}
                  onChange={handleChange}
                  fullWidth
                  margin="normal"
                  multiline
                  rows={4}
                  disabled
                />
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth margin="normal">
                  <Typography variant="subtitle1" gutterBottom>
                    Project Stage
                  </Typography>
                  <Select
                    value={bookForm.stage || "Start"}
                    onChange={(e) => setBookForm({...bookForm, stage: e.target.value})}
                    fullWidth
                  >
                    <MenuItem value="Start">Start</MenuItem>
                    <MenuItem value="Process">Process</MenuItem>
                    <MenuItem value="Testing">Testing</MenuItem>
                    <MenuItem value="Deployment">Deployment</MenuItem>
                    <MenuItem value="Finish">Finish</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <Typography variant="h6" style={{ marginTop: "16px", marginBottom: "8px" }}>
              Select Developers
            </Typography>
            <Grid container spacing={1}>
              {users.map((user) => (
                <Grid item xs={12} sm={6} md={4} key={user.id}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={selectedDevelopers.some((dev) => dev.id === user.id)}
                        onChange={(event) => handleDeveloperSelection(event, user)}
                        name={user.name}
                        color="primary"
                      />
                    }
                    label={user.name}
                  />
                </Grid>
              ))}
            </Grid>
          </Container>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => {
              setEditModal(false);
              setSelectedDevelopers([]);
            }} 
            color="secondary"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            color="primary"
            endIcon={<SaveIcon />}
            disabled={processing}
          >
            {processing ? <CircularProgress size={24} /> : "Save"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );

  return (
    <Container maxWidth="lg" style={{ marginTop: "20px", marginBottom: "20px" }}>
      {alert && (
        <Alert 
          severity="success" 
          onClose={() => setAlert("")} 
          style={{ marginBottom: "20px" }}
        >
          {alert}
        </Alert>
      )}
      {errorAlert && (
        <Alert 
          severity="error" 
          onClose={() => setErrorAlert("")} 
          style={{ marginBottom: "20px" }}
        >
          {errorAlert}
        </Alert>
      )}
      
      {fieldMismatches.length > 0 && (
        <Alert 
          severity="warning" 
          onClose={() => setFieldMismatches([])} 
          style={{ marginBottom: "20px" }}
        >
          Field mismatches detected in {fieldMismatches.length} project(s). 
          Please check console for details.
        </Alert>
      )}

      <Typography variant="h4" component="h1" gutterBottom>
        Project Allocation
      </Typography>

      <TableContainer component={Paper} elevation={3}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Project Name</TableCell>
              <TableCell>Coding Language</TableCell>
              <TableCell>Database</TableCell>
              <TableCell>Duration</TableCell>
              <TableCell>Register Date</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Project Developer</TableCell>
              <TableCell>Stage</TableCell>
              <TableCell align="center">Allocate</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} align="center">
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : filterData.length > 0 ? (
              filterData.map((book) => {
                const projectAllocation = TL.find((item) => item.projectName === book.projectname);
                const currentStatus = status.find(item => item.projectname === book.projectname);
                
                return (
                  <TableRow key={book._id}>
                    <TableCell>{book.projectname}</TableCell>
                    <TableCell>{book.codinglanguage}</TableCell>
                    <TableCell>{book.databasename}</TableCell>
                    <TableCell>{book.duration}</TableCell>
                    <TableCell>{book.registerdate}</TableCell>
                    <TableCell>{book.description}</TableCell>
                    <TableCell>
                      {projectAllocation?.teamLead?.join(", ") || "Not Assigned"}
                    </TableCell>
                    <TableCell style={{ 
                      backgroundColor: getStageColor(currentStatus?.stage || projectStages[book._id])
                    }}>
                      <FormControl fullWidth>
                        <p>{currentStatus?.stage || projectStages[book._id] || "Start"}</p>
                      </FormControl>
                    </TableCell>
                    <TableCell align="center">
                      <Button
                        startIcon={<EditIcon />}
                        style={{ color: "#27ae60" }}
                        onClick={() => {
                          setBookForm({
                            ...book,
                            stage: currentStatus?.stage || projectStages[book._id] || "Start"
                          });
                          setSelectedDevelopers(
                            users.filter(user => 
                              projectAllocation?.teamLead?.includes(user.name)
                            )
                          );
                          setEditModal(true);
                        }}
                      >
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={9} align="center">
                  No projects assigned to you
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {editDialog}
    </Container>
  );
}

export default LeadAllocation;