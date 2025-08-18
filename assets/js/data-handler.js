// Fungsi untuk memuat data dari file JSON
async function loadData(file) {
    try {
        const response = await fetch(`/data/${file}.json`);
        if (!response.ok) {
            throw new Error(`Gagal memuat data: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error:', error);
        return null;
    }
}

// Fungsi untuk memuat profil
async function loadProfile() {
    const profile = await loadData('profile');
    if (profile) {
        // Update data profil di halaman
        document.querySelectorAll('[data-profile="name"]').forEach(el => {
            el.textContent = profile.name;
        });
        
        document.querySelectorAll('[data-profile="title"]').forEach(el => {
            el.textContent = profile.title;
        });
        
        // Update link sosial media
        Object.entries(profile.social).forEach(([platform, url]) => {
            const el = document.querySelector(`[data-social="${platform}"]`);
            if (el) {
                el.href = url;
            }
        });
    }
}

// Fungsi untuk memuat proyek
async function loadProjects() {
    const projects = await loadData('projects');
    const container = document.getElementById('projects-container');
    
    if (projects && container) {
        container.innerHTML = projects.map(project => `
            <div class="col-lg-4 col-md-6">
                <div class="project-item wow fadeInUp">
                    <div class="project-img">
                        <img src="${project.image}" alt="${project.title}">
                        <div class="project-content">
                            <h4>${project.title}</h4>
                            <p>${project.description}</p>
                            <div class="project-tags">
                                ${project.tags.map(tag => `<span>${tag}</span>`).join('')}
                            </div>
                            <div class="project-links">
                                <a href="${project.demo_url}" class="project-link">Demo</a>
                                <a href="${project.source_url}" class="project-link">Source</a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    }
}

// Fungsi untuk memuat pengalaman kerja
async function loadExperience() {
    const experiences = await loadData('experience');
    const container = document.getElementById('experience-container');
    
    if (experiences && container) {
        container.innerHTML = experiences.map(exp => `
            <div class="resume-box">
                <span class="resume-date">${exp.period}</span>
                <h5 class="fw-medium">${exp.position}</h5>
                <span>@ ${exp.company}</span>
                <p>${exp.description}</p>
                <ul>
                    ${exp.responsibilities.map(resp => `<li>${resp}</li>`).join('')}
                </ul>
            </div>
        `).join('');
    }
}

// Panggil fungsi-fungsi saat halaman dimuat
document.addEventListener('DOMContentLoaded', () => {
    loadProfile();
    loadProjects();
    loadExperience();
});
