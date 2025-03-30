import axios from 'axios'
import React, { useEffect, useState } from 'react'
import {
  CircularProgress,
  Typography,
  Box,
  Paper,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button
} from '@material-ui/core';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Bar, Radar, Line } from 'react-chartjs-2';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import PictureAsPdfIcon from '@material-ui/icons/PictureAsPdf';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler
);

const FeedbackGraph = () => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [statistics, setStatistics] = useState(null);
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState('all');

    const getUsers = async () => {
        try {
            const response = await axios.get('http://localhost:4000/api/users/all', {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("token")}`
                }
            });
            setUsers(response.data);
        } catch (err) {
            console.error("Error fetching users:", err);
        }
    };

    const getData = async () => {
        try {
            setLoading(true);
            const params = {
                page: 1,
                limit: 10,
                sortBy: 'submittedAt',
                sortOrder: 'desc'
            };

            if (selectedUser !== 'all') {
                params.userId = selectedUser;
            }

            const response = await axios.get('http://localhost:4000/api/feedback/statistics', {
                params,
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("token")}`
                }
            });
            setStatistics(response.data);
            setError(null);
        } catch (err) {
            console.error("Error fetching statistics:", err);
            setError(err.response?.data?.message || "Failed to fetch feedback statistics");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        getUsers();
    }, []);

    useEffect(() => {
        getData();
    }, [selectedUser]);

    const handleUserChange = (event) => {
        setSelectedUser(event.target.value);
    };

    const generatePDF = () => {
        if (!statistics || selectedUser === 'all') return;

        const selectedUserData = users.find(user => user._id === selectedUser);
        if (!selectedUserData) return;

        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        // Title
        doc.setFontSize(20);
        doc.text('Developer Performance Report', pageWidth / 2, 20, { align: 'center' });
        doc.setFontSize(12);
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, pageWidth / 2, 30, { align: 'center' });

        // Developer Information
        doc.setFontSize(14);
        doc.text('Developer Information', 20, 45);
        doc.setFontSize(12);
        doc.text(`Name: ${selectedUserData.name}`, 20, 55);
        doc.text(`Total Feedbacks: ${statistics.totalFeedbacks}`, 20, 65);

        // Skill Performance Table
        const skillData = statistics.feedbacks.flatMap(f => f.skills);
        const skillSummary = {};
        skillData.forEach(skill => {
            if (!skillSummary[skill.name]) {
                skillSummary[skill.name] = {
                    total: 0,
                    count: 0,
                    average: 0
                };
            }
            skillSummary[skill.name].total += skill.rating;
            skillSummary[skill.name].count++;
            skillSummary[skill.name].average = skillSummary[skill.name].total / skillSummary[skill.name].count;
        });

        const tableData = Object.entries(skillSummary).map(([skill, data]) => [
            skill,
            data.average.toFixed(2),
            data.count.toString()
        ]);

        doc.autoTable({
            startY: 75,
            head: [['Skill', 'Average Rating', 'Number of Reviews']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [41, 128, 185] },
            styles: { fontSize: 10 }
        });

        // Project Performance
        const projectData = statistics.feedbacks.map(f => ({
            project: f.projectName,
            rating: f.averageRating,
            date: new Date(f.submittedAt).toLocaleDateString()
        }));

        doc.autoTable({
            startY: doc.lastAutoTable.finalY + 10,
            head: [['Project', 'Average Rating', 'Review Date']],
            body: projectData.map(p => [p.project, p.rating.toFixed(2), p.date]),
            theme: 'grid',
            headStyles: { fillColor: [41, 128, 185] },
            styles: { fontSize: 10 }
        });

        // Save the PDF
        doc.save(`${selectedUserData.name}_performance_report.pdf`);
    };

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" p={3}>
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Box p={3}>
                <Paper 
                    elevation={3} 
                    style={{ 
                        padding: 16, 
                        backgroundColor: '#ffebee',
                        border: '1px solid #ef5350'
                    }}
                >
                    <Typography color="error">
                        {error}
                    </Typography>
                </Paper>
            </Box>
        );
    }

    if (!statistics || statistics.feedbacks.length === 0) {
        return (
            <Box p={3}>
                <Paper 
                    elevation={3} 
                    style={{ 
                        padding: 16, 
                        backgroundColor: '#e3f2fd',
                        border: '1px solid #2196f3'
                    }}
                >
                    <Typography color="primary">
                        No feedback data available yet
                    </Typography>
                </Paper>
            </Box>
        );
    }

    // Prepare data for charts
    const feedbacks = statistics.feedbacks;
    const skillNames = [...new Set(feedbacks.flatMap(f => f.skills.map(s => s.name)))];
    
    // Calculate skill averages
    const skillAverages = skillNames.map(skillName => {
        const skillRatings = feedbacks.flatMap(f => 
            f.skills.filter(s => s.name === skillName).map(s => s.rating)
        );
        return skillRatings.reduce((acc, val) => acc + val, 0) / skillRatings.length;
    });

    // Calculate user averages
    const userNames = [...new Set(feedbacks.map(f => f.userName))];
    const userAverages = userNames.map(userName => {
        const userFeedbacks = feedbacks.filter(f => f.userName === userName);
        return userFeedbacks.reduce((acc, f) => acc + f.averageRating, 0) / userFeedbacks.length;
    });

    // Calculate project averages
    const projectNames = [...new Set(feedbacks.map(f => f.projectName))];
    const projectAverages = projectNames.map(projectName => {
        const projectFeedbacks = feedbacks.filter(f => f.projectName === projectName);
        return projectFeedbacks.reduce((acc, f) => acc + f.averageRating, 0) / projectFeedbacks.length;
    });

    const baseOptions = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: {
                beginAtZero: true,
                max: 5,
                ticks: {
                    stepSize: 1
                }
            }
        },
        plugins: {
            legend: {
                position: 'top',
            },
            tooltip: {
                mode: 'index',
                intersect: false,
            }
        }
    };

    const radarChartData = {
        labels: skillNames,
        datasets: [
            {
                label: 'Overall Skill Performance',
                data: skillAverages,
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                borderColor: 'rgb(75, 192, 192)',
                borderWidth: 2,
                pointBackgroundColor: 'rgb(75, 192, 192)',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: 'rgb(75, 192, 192)',
            }
        ]
    };

    const userBarChartData = {
        labels: userNames,
        datasets: [
            {
                label: 'Average Rating',
                data: userAverages,
                backgroundColor: 'rgba(54, 162, 235, 0.5)',
                borderColor: 'rgb(54, 162, 235)',
                borderWidth: 1,
            }
        ]
    };

    const projectLineChartData = {
        labels: projectNames,
        datasets: [
            {
                label: 'Project Performance',
                data: projectAverages,
                fill: false,
                borderColor: 'rgb(255, 99, 132)',
                tension: 0.1,
                pointRadius: 4,
                pointHoverRadius: 6,
            }
        ]
    };

    return (
        <Box p={3}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h5">
                    Feedback Analysis
                </Typography>
                <Box display="flex" alignItems="center" gap={2}>
                    <FormControl style={{ minWidth: 200 }}>
                        <InputLabel>Select User</InputLabel>
                        <Select
                            value={selectedUser}
                            onChange={handleUserChange}
                            label="Select User"
                        >
                            <MenuItem value="all">All Users</MenuItem>
                            {users.map((user) => (
                                <MenuItem key={user._id} value={user._id}>
                                    {user.name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    {selectedUser !== 'all' && (
                        <Button
                            variant="contained"
                            color="primary"
                            startIcon={<PictureAsPdfIcon />}
                            onClick={generatePDF}
                        >
                            Download Report
                        </Button>
                    )}
                </Box>
            </Box>
            <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                    <Paper elevation={3} style={{ padding: 16, height: 400 }}>
                        <Typography variant="h6" gutterBottom>
                            Skill Distribution
                        </Typography>
                        <Radar data={radarChartData} options={baseOptions} />
                    </Paper>
                </Grid>
                <Grid item xs={12} md={6}>
                    <Paper elevation={3} style={{ padding: 16, height: 400 }}>
                        <Typography variant="h6" gutterBottom>
                            User Performance
                        </Typography>
                        <Bar data={userBarChartData} options={baseOptions} />
                    </Paper>
                </Grid>
                <Grid item xs={12}>
                    <Paper elevation={3} style={{ padding: 16, height: 400 }}>
                        <Typography variant="h6" gutterBottom>
                            Project Performance
                        </Typography>
                        <Line data={projectLineChartData} options={baseOptions} />
                    </Paper>
                </Grid>
            </Grid>
            <Box mt={3}>
                <Typography variant="body1" color="textSecondary">
                    Total Feedbacks: {statistics.totalFeedbacks} | 
                    Current Page: {statistics.currentPage} of {statistics.totalPages}
                </Typography>
            </Box>
        </Box>
    );
}

export default FeedbackGraph;