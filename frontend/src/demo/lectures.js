// The demo's lectures: openly licensed MIT OpenCourseWare recordings, processed once with the real
// pipeline (demo/build_data.py writes data/<slug>.json from the CLI outputs).
import qp1 from "./data/qp1.json";
import alg1 from "./data/alg1.json";
import la1 from "./data/la1.json";

const CC_BY_NC_SA = { name: "CC BY-NC-SA 4.0", url: "https://creativecommons.org/licenses/by-nc-sa/4.0/" };

export const LECTURES = [
  {
    slug: "qp1",
    data: qp1,
    youtube_id: "lZ3bPUKo5zc",
    title: "Lecture 1: Introduction to Superposition",
    instructor: "Prof. Allan Adams",
    course: "8.04 Quantum Physics I, Spring 2013",
    ocw_url: "https://ocw.mit.edu/courses/8-04-quantum-physics-i-spring-2013/resources/lecture-1/",
    licence: CC_BY_NC_SA,
  },
  {
    slug: "alg1",
    data: alg1,
    youtube_id: "ZA-tUyM_y7s",
    title: "Lecture 1: Algorithms and Computation",
    instructor: "Dr. Jason Ku",
    course: "6.006 Introduction to Algorithms, Spring 2020",
    ocw_url: "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/resources/lecture-1-algorithms-and-computation/",
    licence: CC_BY_NC_SA,
  },
  {
    slug: "la1",
    data: la1,
    youtube_id: "J7DzL2_Na80",
    title: "Lecture 1: The Geometry of Linear Equations",
    instructor: "Prof. Gilbert Strang",
    course: "18.06 Linear Algebra, Spring 2010 (recorded 1999)",
    ocw_url: "https://ocw.mit.edu/courses/18-06-linear-algebra-spring-2010/resources/lecture-1-the-geometry-of-linear-equations/",
    licence: CC_BY_NC_SA,
  },
];
