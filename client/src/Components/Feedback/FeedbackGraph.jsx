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
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@material-ui/core';
import Rating from '@material-ui/lab/Rating';
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
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
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
    const [feedbackData, setFeedbackData] = useState([]);
    const [projects, setProjects] = useState([]);
    const [selectedProject, setSelectedProject] = useState('');
    const [projectDevelopers, setProjectDevelopers] = useState([]);

    // Fetch all feedback data
    const getFeedbackData = async () => {
        try {
            setLoading(true);
            const response = await axios.get('http://localhost:4000/api/feedback/users/all-data', {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("token")}`
                }
            });
            
            if (response.data && response.data.data) {
                setFeedbackData(response.data.data);
                
                // Extract unique projects from feedback data
                const uniqueProjects = [...new Set(response.data.data.map(item => item.projectName))];
                setProjects(uniqueProjects);
                
                if (uniqueProjects.length > 0) {
                    setSelectedProject(uniqueProjects[0]);
                }
            } else {
                setError("Invalid data format received from server");
            }
            setError(null);
        } catch (err) {
            console.error("Error fetching feedback data:", err);
            setError(err.response?.data?.message || "Failed to fetch feedback data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        getFeedbackData();
    }, []);

    // Filter developers when project changes
    useEffect(() => {
        if (selectedProject && feedbackData.length > 0) {
            // Get all feedback for the selected project
            const projectFeedback = feedbackData.filter(feedback => 
                feedback.projectName === selectedProject
            );
            
            // Group feedback by developer
            const developerMap = {};
            projectFeedback.forEach(feedback => {
                const userId = feedback.userId;
                if (!developerMap[userId]) {
                    developerMap[userId] = {
                        userId: userId,
                        userName: feedback.userName,
                        reviews: [],
                        latestReview: null,
                        totalReviews: 0,
                        averageRating: 0
                    };
                }
                
                // Add review
                developerMap[userId].reviews.push(feedback);
                developerMap[userId].totalReviews++;
                
                // Update latest review
                const reviewDate = new Date(feedback.submittedAt);
                if (!developerMap[userId].latestReview || 
                    reviewDate > new Date(developerMap[userId].latestReview)) {
                    developerMap[userId].latestReview = feedback.submittedAt;
                }
                
                // Calculate average rating across all skills
                const skillsAvg = feedback.skills.reduce((sum, skill) => sum + skill.rating, 0) / feedback.skills.length;
                developerMap[userId].averageRating = 
                    ((developerMap[userId].averageRating * (developerMap[userId].totalReviews - 1)) + skillsAvg) / 
                    developerMap[userId].totalReviews;
            });
            
            // Convert to array and sort by username
            const developers = Object.values(developerMap).sort((a, b) => 
                a.userName.localeCompare(b.userName)
            );
            
            setProjectDevelopers(developers);
        } else {
            setProjectDevelopers([]);
        }
    }, [selectedProject, feedbackData]);

    const handleProjectChange = (event) => {
        setSelectedProject(event.target.value);
    };

    const getRatingDescription = (rating) => {
        switch (Math.round(rating)) {
            case 1: return 'Poor';
            case 2: return 'Average';
            case 3: return 'Normal';
            case 4: return 'Good';
            case 5: return 'Excellent';
            default: return 'Not Rated';
        }
    };

    const generatePDF = (developer) => {
        try {
            console.log('Starting PDF generation for developer:', developer.userName);
            
            if (!selectedProject) {
                alert('Please select a project first');
                return;
            }

            if (!developer || developer.reviews.length === 0) {
                alert('No feedback data found for this developer');
                return;
            }

            // Create a new PDF document with explicit settings
            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });
            
            const pageWidth = doc.internal.pageSize.getWidth();
            console.log('PDF document created, page width:', pageWidth);

            try {
                // Title
                doc.setFontSize(20);
                doc.text('Developer Performance Report', pageWidth / 2, 20, { align: 'center' });
                doc.setFontSize(12);
                doc.text(`Generated on: ${new Date().toLocaleDateString()}`, pageWidth / 2, 30, { align: 'center' });
                console.log('Added title to PDF');

                // Project and Developer Information
                doc.setFontSize(14);
                doc.text('Project Information', 20, 45);
                doc.setFontSize(12);
                doc.text(`Project Name: ${selectedProject}`, 20, 55);
                
                doc.setFontSize(14);
                doc.text('Developer Information', 20, 75);
                doc.setFontSize(12);
                doc.text(`Developer Name: ${developer.userName}`, 20, 85);
                doc.text(`Total Reviews: ${developer.totalReviews}`, 20, 95);
                doc.text(`Average Rating: ${developer.averageRating.toFixed(1)} (${getRatingDescription(developer.averageRating)})`, 20, 105);
                console.log('Added developer information to PDF');

                // Skills Table
                const latestReview = developer.reviews.reduce((latest, review) => 
                    new Date(review.submittedAt) > new Date(latest.submittedAt) ? review : latest
                , developer.reviews[0]);
                
                console.log('Latest review:', latestReview);
                
                let skillsTableEnd = 145;
                
                // Check if skills array exists and has items
                if (latestReview.skills && latestReview.skills.length > 0) {
                    const skillsData = latestReview.skills.map(skill => [
                        skill.skillName,
                        skill.rating,
                        getRatingDescription(skill.rating)
                    ]);

                    doc.setFontSize(14);
                    doc.text('Skills Assessment', 20, 125);
                    
                    // Use the imported autoTable instead of doc.autoTable
                    autoTable(doc, {
                        startY: 135,
                        head: [['Skill', 'Rating', 'Performance Level']],
                        body: skillsData,
                        theme: 'grid',
                        headStyles: { fillColor: [41, 128, 185] },
                        styles: { fontSize: 10 }
                    });
                    console.log('Added skills table to PDF');
                    
                    // Get the end position of the skills table
                    skillsTableEnd = doc.lastAutoTable.finalY + 20;
                } else {
                    doc.setFontSize(14);
                    doc.text('Skills Assessment', 20, 125);
                    doc.setFontSize(12);
                    doc.text('No skills data available', 20, 135);
                    console.log('No skills data available');
                }

                // Review History Table
                const reviewData = developer.reviews.map(review => [
                    new Date(review.submittedAt).toLocaleDateString(),
                    review.overallReview || 'No review provided',
                    review.reviewedBy || 'Unknown Reviewer'
                ]);
                
                doc.setFontSize(14);
                doc.text('Review History', 20, skillsTableEnd);
                
                // Use the imported autoTable for the review history table
                autoTable(doc, {
                    startY: skillsTableEnd + 10,
                    head: [['Review Date', 'Overall Review', 'Reviewed By']],
                    body: reviewData,
                    theme: 'grid',
                    headStyles: { fillColor: [41, 128, 185] },
                    styles: { fontSize: 10 }
                });
                console.log('Added review history table to PDF');

                // Save the PDF with a safe filename (remove special characters)
                const safeUserName = developer.userName.replace(/[^a-z0-9]/gi, '_');
                const safeProjectName = selectedProject.replace(/[^a-z0-9]/gi, '_');
                const fileName = `${safeUserName}_${safeProjectName}_report.pdf`;
                
                console.log('Saving PDF with filename:', fileName);
                
                // Use simple save method to avoid compatibility issues
                doc.save(fileName);
                console.log('PDF saved successfully');
                
            } catch (contentError) {
                console.error('Error while adding content to PDF:', contentError);
                alert('Error generating PDF content: ' + contentError.message);
            }
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Error generating PDF report. Error details: ' + error.message);
        }
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

    if (feedbackData.length === 0) {
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

    return (
        <Box p={3}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h5">
                    Project Feedback Analysis
                </Typography>
                <Box display="flex" alignItems="center" gap={2}>
                    <FormControl style={{ minWidth: 200 }}>
                        <InputLabel>Select Project</InputLabel>
                        <Select
                            value={selectedProject}
                            onChange={handleProjectChange}
                            label="Select Project"
                        >
                            {projects.map((project) => (
                                <MenuItem key={project} value={project}>
                                    {project}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Box>
            </Box>
            
            <Paper elevation={3} style={{ padding: 16 }}>
                <Typography variant="h6" gutterBottom>
                    {selectedProject ? `${selectedProject} - Developer Reviews` : 'Select a project to view developers'}
                </Typography>
                
                {projectDevelopers.length > 0 ? (
                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Developer Name</TableCell>
                                    <TableCell align="center">Total Reviews</TableCell>
                                    <TableCell align="center">Average Rating</TableCell>
                                    <TableCell align="center">Performance Level</TableCell>
                                    <TableCell align="center">Latest Review</TableCell>
                                    <TableCell align="center">Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {projectDevelopers.map((developer) => (
                                    <TableRow key={developer.userId}>
                                        <TableCell>{developer.userName}</TableCell>
                                        <TableCell align="center">{developer.totalReviews}</TableCell>
                                        <TableCell align="center">
                                            <Box display="flex" justifyContent="center">
                                                <Rating 
                                                    value={developer.averageRating} 
                                                    precision={0.5} 
                                                    readOnly 
                                                    size="small"
                                                />
                                            </Box>
                                        </TableCell>
                                        <TableCell align="center">
                                            {getRatingDescription(developer.averageRating)}
                                        </TableCell>
                                        <TableCell align="center">
                                            {new Date(developer.latestReview).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell align="center">
                                            <Button
                                                variant="contained"
                                                color="primary"
                                                size="small"
                                                startIcon={<PictureAsPdfIcon />}
                                                onClick={() => generatePDF(developer)}
                                            >
                                                Download
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                ) : (
                    <Typography color="textSecondary" align="center" style={{ padding: 20 }}>
                        No developers found for this project
                    </Typography>
                )}
            </Paper>
        </Box>
    );
};

export default FeedbackGraph;