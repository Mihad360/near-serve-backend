export const template = `
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Welcome to LMS App</title>
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      body {
        font-family: Arial, sans-serif;
        background-color: #ffffff;
        color: #333;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        line-height: 1.6;
      }

      .hero {
        width: 100%;
        background-color: #ffffff;
        padding: 120px 20px 60px;
        text-align: center;
      }

      .hero h1 {
        font-size: 3rem;
        margin-bottom: 15px;
        color: #333;
      }

      .hero h2 {
        font-size: 1.5rem;
        margin-bottom: 25px;
        font-weight: 300;
        color: #666;
      }

      .cta-button {
        background-color: #f5c400;
        color: #000;
        padding: 14px 35px;
        font-size: 1rem;
        border: none;
        border-radius: 30px;
        cursor: pointer;
        font-weight: 600;
        text-transform: uppercase;
        transition: background-color 0.3s ease;
      }

      .cta-button:hover {
        background-color: #e0b300;
      }

      .features {
        width: 85%;
        max-width: 1000px;
        padding: 50px 20px;
        text-align: center;
        background-color: #ffffff;
        margin-top: 20px;
      }

      .features h3 {
        font-size: 2.4rem;
        margin-bottom: 20px;
        color: #333;
      }

      .features p {
        font-size: 1.1rem;
        color: #666;
        margin-bottom: 35px;
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 25px;
      }

      .grid-item {
        background-color: #fff9e6;
        padding: 25px;
        border-radius: 12px;
        border: 1px solid #f5c400;
        transition: transform 0.3s ease;
      }

      .grid-item:hover {
        transform: translateY(-6px);
      }

      .grid-item h4 {
        font-size: 1.4rem;
        margin-bottom: 10px;
        color: #333;
      }

      .grid-item p {
        font-size: 1rem;
        color: #555;
      }

      footer {
        width: 100%;
        background-color: #fff;
        color: #666;
        text-align: center;
        padding: 20px;
        font-size: 0.9rem;
        border-top: 1px solid #f5c400;
        margin-top: 50px;
      }

      footer span {
        color: #f5c400;
        font-weight: 600;
      }
    </style>
  </head>
  <body>
    <section class="hero">
      <h1>Welcome to LMS App</h1>
      <h2>Learn anytime, anywhere. Manage courses, students, and progress with ease.</h2>
      <button class="cta-button">Get Started</button>
    </section>

    <div class="features">
      <h3>Why Choose LMS App?</h3>
      <p>A complete learning management solution for students and educators.</p>
      <div class="grid">
        <div class="grid-item">
          <h4>Online Courses</h4>
          <p>Access structured courses with videos, materials, and assignments.</p>
        </div>
        <div class="grid-item">
          <h4>Student Management</h4>
          <p>Track student progress, performance, and attendance easily.</p>
        </div>
        <div class="grid-item">
          <h4>Certifications</h4>
          <p>Provide course completion certificates and learning achievements.</p>
        </div>
      </div>
    </div>

    <footer>
      <p>&copy; 2025 <span>LMS App</span>. All rights reserved.</p>
    </footer>
  </body>
</html>
`;
